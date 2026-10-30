import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { ExportLog } from '../../database/entities/export-log.entity';
import { User } from '../../database/entities/user.entity';
import { DashboardIndicatorsService } from '../dashboard/dashboard-indicators.service';
import { ExportPatientsQueryDto } from './dto/export-patients-query.dto';
import {
  CATALOG_COLUMNS,
  ENUM_COLUMNS,
  ENUM_LABELS,
  headerFor,
} from './export-labels';

interface SheetDefinition {
  name: string;
  /** Rows of one entity for `$1::uuid[]` patients; must expose patient_id. */
  sql: string;
  /** Table that must exist for the sheet to be exported. */
  requires?: string;
}

const PATIENT_KEY = `
  p.id AS patient_id, p.dni AS patient_document, p.full_name AS patient_name
`;

const SHEETS: SheetDefinition[] = [
  {
    name: 'Pacientes',
    sql: `
      SELECT p.id AS patient_id, p.dni AS patient_document, p.full_name, p.document_type,
        p.birth_date, p.gender, p.email, p.primary_phone, p.secondary_phone,
        p.activity_status, p.deactivation_reason, p.deactivated_at, p.deceased_at,
        (SELECT MIN(e.enrolled_on) FROM enrollments e WHERE e.patient_id = p.id) AS enrolled_on,
        d.health_phase, d.health_subcategory, hc.name AS health_center_name,
        a.department, a.province, a.district,
        d.zone_type, d.education_level, d.native_language, d.is_working,
        ins.insurance_type, ins.eps_provider, p.created_at
      FROM patients p
      LEFT JOIN patient_details d ON d.patient_id = p.id
      LEFT JOIN health_centers hc ON hc.id = d.primary_health_center_id
      LEFT JOIN LATERAL (
        SELECT department, province, district FROM patient_addresses
        WHERE patient_id = p.id AND is_primary AND is_active
        ORDER BY created_at DESC LIMIT 1
      ) a ON true
      LEFT JOIN LATERAL (
        SELECT insurance_type, eps_provider FROM patient_insurance
        WHERE patient_id = p.id AND is_current
        ORDER BY created_at DESC LIMIT 1
      ) ins ON true
      WHERE p.id = ANY($1::uuid[])
      ORDER BY p.full_name`,
  },
  {
    name: 'Acompañantes',
    sql: `
      SELECT ${PATIENT_KEY}, c.id AS companion_id, c.full_name AS companion_name,
        c.dni AS companion_document, c.primary_phone, c.gender,
        COALESCE(rel.label, cp.relationship) AS relationship,
        cp.contact_role, cp.is_caregiver, cp.is_primary_contact, cp.created_at
      FROM companion_patient cp
      JOIN patients p ON p.id = cp.patient_id
      JOIN companions c ON c.id = cp.companion_id
      LEFT JOIN catalog_items rel
        ON rel.kind = 'companion_relationship' AND rel.code = cp.relationship
      WHERE cp.patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, cp.created_at`,
  },
  {
    name: 'Enrolamientos',
    sql: `
      SELECT ${PATIENT_KEY}, e.*
      FROM enrollments e JOIN patients p ON p.id = e.patient_id
      WHERE e.patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, e.enrolled_on`,
  },
  {
    name: 'Seguimientos',
    sql: `
      SELECT ${PATIENT_KEY}, f.id, ag.full_name AS agent_name,
        COALESCE(ic.full_name, 'Paciente') AS interlocutor_name, f.type, f.status,
        f.purpose, f.scheduled_at, f.completed_at, f.notes, f.is_historical, f.created_at
      FROM follow_ups f
      JOIN patients p ON p.id = f.subject_patient_id
      LEFT JOIN agents ag ON ag.id = f.agent_id
      LEFT JOIN companions ic ON ic.id = f.interlocutor_companion_id
      WHERE f.subject_patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, COALESCE(f.completed_at, f.scheduled_at, f.created_at)`,
  },
  {
    name: 'Intentos de seguimiento',
    requires: 'follow_up_attempts',
    sql: `
      SELECT ${PATIENT_KEY}, t.*
      FROM follow_up_attempts t
      JOIN follow_ups f ON f.id = t.follow_up_id
      JOIN patients p ON p.id = f.subject_patient_id
      WHERE f.subject_patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.created_at`,
  },
  {
    name: 'Diagnósticos',
    sql: `
      SELECT ${PATIENT_KEY}, t.id, t.diagnosis, t.diagnosis_other, t.cancer_stage,
        t.diagnosis_date, t.diagnosis_specialty, hc.name AS health_center_name,
        t.first_symptoms_date, t.is_current, t.change_reason, t.created_at
      FROM patient_diagnoses t
      JOIN patients p ON p.id = t.patient_id
      LEFT JOIN health_centers hc ON hc.id = t.health_center_id
      WHERE t.patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.created_at`,
  },
  {
    name: 'Estado diagnóstico',
    sql: `
      SELECT ${PATIENT_KEY}, t.id, t.status, t.occurred_at, t.reported_diagnosis,
        t.diagnosis_id, t.supported_by_sepa, t.notes, t.created_at
      FROM patient_diagnostic_status_events t
      JOIN patients p ON p.id = t.patient_id
      WHERE t.patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.occurred_at`,
  },
  {
    name: 'Tratamientos',
    sql: `
      SELECT ${PATIENT_KEY}, t.*
      FROM patient_treatments t JOIN patients p ON p.id = t.patient_id
      WHERE t.patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.series_id, t.created_at`,
  },
  {
    name: 'Citas médicas',
    sql: `
      SELECT ${PATIENT_KEY}, t.*
      FROM patient_medical_appointments t JOIN patients p ON p.id = t.patient_id
      WHERE t.patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.appointment_date`,
  },
  {
    name: 'Psicooncología',
    sql: `
      SELECT ${PATIENT_KEY}, t.id, t.beneficiary_type, t.status, t.session_number,
        CONCAT_WS(' ', v.first_name, v.last_name) AS volunteer_name, t.scheduled_at, t.completed_at,
        t.topic_addressed, t.created_at
      FROM psychooncology_appointments t
      JOIN patients p ON p.id = t.patient_id
      LEFT JOIN volunteers v ON v.id = t.volunteer_id
      WHERE t.patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.scheduled_at`,
  },
  {
    name: 'Recordatorios',
    sql: `
      SELECT ${PATIENT_KEY}, t.*
      FROM reminders t JOIN patients p ON p.id = t.subject_patient_id
      WHERE t.subject_patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.due_at`,
  },
  {
    name: 'Alertas',
    sql: `
      SELECT ${PATIENT_KEY}, t.*, hc.name AS health_center_name
      FROM alerts t
      JOIN follow_ups f ON f.id = t.follow_up_id
      JOIN patients p ON p.id = f.subject_patient_id
      LEFT JOIN health_centers hc ON hc.id = t.health_center_id
      WHERE f.subject_patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.created_at`,
  },
  {
    name: 'Encuestas',
    sql: `
      SELECT ${PATIENT_KEY}, t.id, t.type, t.rating, t.comment, t.channel,
        t.answered_at, u.email AS actor_name, t.follow_up_id,
        t.psychooncology_appointment_id
      FROM surveys t
      JOIN patients p ON p.id = t.patient_id
      LEFT JOIN users u ON u.id = t.actor_user_id
      WHERE t.patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.answered_at`,
  },
  {
    name: 'Bajas y reactivaciones',
    sql: `
      SELECT ${PATIENT_KEY}, t.status, t.reason, t.reason_detail, t.deceased_at,
        t.occurred_at, u.email AS actor_name, t.follow_up_id
      FROM patient_activity_events t
      JOIN patients p ON p.id = t.patient_id
      LEFT JOIN users u ON u.id = t.actor_user_id
      WHERE t.patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.occurred_at`,
  },
  {
    name: 'Historial de cambios',
    sql: `
      SELECT ${PATIENT_KEY}, t.changed_at, t.entity_type, t.entity_id, t.operation,
        t.field, t.old_value::text AS old_value, t.new_value::text AS new_value,
        t.context, t.follow_up_id, u.email AS actor_name
      FROM change_log t
      JOIN patients p ON p.id = t.patient_id
      LEFT JOIN users u ON u.id = t.actor_user_id
      WHERE t.patient_id = ANY($1::uuid[])
      ORDER BY p.full_name, t.changed_at`,
  },
];

const HIDDEN_COLUMNS = new Set(['patient_id_1']);
const TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:?\d{2}|Z)$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const limaFormat = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

@Injectable()
export class ExportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly indicators: DashboardIndicatorsService,
    @InjectRepository(ExportLog)
    private readonly logs: Repository<ExportLog>,
  ) {}

  async exportPatients(
    query: ExportPatientsQueryDto,
    user: User,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const hasPeriod = Boolean(query.from || query.to || query.period);
    const bounds = hasPeriod
      ? this.indicators.getBounds(query)
      : this.indicators.boundsFromDates('2000-01-01', this.tomorrow());
    const patientIds = await this.indicators.cohortPatientIds(query, bounds, {
      includeInactive: !query.population,
    });
    const catalog = await this.catalogLabels();
    const workbook = new Workbook();
    workbook.creator = 'CRM SEPA';
    workbook.created = new Date();
    const rowCounts: Record<string, number> = {};

    for (const sheet of SHEETS) {
      if (sheet.requires && !(await this.tableExists(sheet.requires))) continue;
      const rows = await this.dataSource.query<
        { r: Record<string, unknown> }[]
      >(`SELECT row_to_json(x) AS r FROM (${sheet.sql}) x`, [patientIds]);
      rowCounts[sheet.name] = rows.length;
      const worksheet = workbook.addWorksheet(sheet.name);
      const columns = rows.length
        ? Object.keys(rows[0].r).filter((c) => !HIDDEN_COLUMNS.has(c))
        : ['patient_id', 'patient_document'];
      worksheet.columns = columns.map((column) => ({
        header: headerFor(column),
        key: column,
        width: Math.min(40, Math.max(12, headerFor(column).length + 2)),
      }));
      worksheet.getRow(1).font = { bold: true };
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
      for (const { r } of rows) {
        const values: Record<string, unknown> = {};
        for (const column of columns)
          values[column] = this.readable(column, r[column], catalog);
        worksheet.addRow(values);
      }
    }

    await this.logs.save(
      this.logs.create({
        userId: user.id,
        filters: { ...query } as Record<string, unknown>,
        rowCounts,
      }),
    );
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const stamp = new Date().toISOString().slice(0, 10);
    return { buffer, fileName: `pacientes-sepa-${stamp}.xlsx` };
  }

  private readable(
    column: string,
    value: unknown,
    catalog: Map<string, string>,
  ): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value !== 'string') return value;
    if (TIMESTAMP.test(value))
      return limaFormat.format(new Date(value)).replace(',', '');
    if (DATE_ONLY.test(value)) return value.split('-').reverse().join('/');
    const kind = CATALOG_COLUMNS[column];
    if (kind) return catalog.get(`${kind}:${value}`) ?? value;
    if (ENUM_COLUMNS.has(column)) return ENUM_LABELS[value] ?? value;
    return value;
  }

  private async catalogLabels(): Promise<Map<string, string>> {
    const rows = await this.dataSource.query<
      { kind: string; code: string; label: string }[]
    >('SELECT kind, code, label FROM catalog_items');
    return new Map(rows.map((row) => [`${row.kind}:${row.code}`, row.label]));
  }

  private async tableExists(table: string): Promise<boolean> {
    const rows = await this.dataSource.query<{ exists: boolean }[]>(
      'SELECT to_regclass($1::text) IS NOT NULL AS exists',
      [`public.${table}`],
    );
    return Boolean(rows[0]?.exists);
  }

  private tomorrow(): string {
    return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  }
}
