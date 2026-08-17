import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { PatientAccessService } from './access/patient-access.service';
import {
  FollowUpTimelineEventDto,
  PatientTimelineEventDto,
  PatientTimelineEventKind,
  PatientTimelineOutcomeDto,
  PatientTimelineOutcomeType,
  PatientTimelineQueryDto,
  PatientTimelineResponseDto,
  PsychooncologyAppointmentTimelineEventDto,
  ReminderTimelineEventDto,
  SocialNoteTimelineEventDto,
} from './dto/patient-timeline.dto';

type TimelineRow = {
  id: string;
  kind: PatientTimelineEventKind;
  occurred_at: Date | string;
  status: string | null;
  follow_up_id: string | null;
  type: string | null;
  purpose: string | null;
  notes: string | null;
  description: string | null;
  modality: string | null;
  session_number: number | null;
  social_note_type: string | null;
  social_note: string | null;
  author_id: string | null;
};

type TimelineOutcomeRow = {
  follow_up_id: string;
  outcome_type: PatientTimelineOutcomeType;
  record_id: string;
  occurred_at: Date | string;
  data: Record<string, unknown>;
};

type OutcomeData = Record<string, unknown>;

const OUTCOME_LABELS: Record<PatientTimelineOutcomeType, string> = {
  [PatientTimelineOutcomeType.DIAGNOSIS]: 'Diagnóstico',
  [PatientTimelineOutcomeType.TREATMENT]: 'Tratamiento',
  [PatientTimelineOutcomeType.MEDICATION]: 'Medicamento',
  [PatientTimelineOutcomeType.SYMPTOM]: 'Síntomas',
  [PatientTimelineOutcomeType.INSURANCE]: 'Seguro de salud',
  [PatientTimelineOutcomeType.SIS_AFFILIATION]: 'Afiliación SIS',
  [PatientTimelineOutcomeType.ADDRESS]: 'Dirección',
  [PatientTimelineOutcomeType.SOCIAL_NOTE]: 'Nota social',
  [PatientTimelineOutcomeType.REMINDER]: 'Recordatorio',
  [PatientTimelineOutcomeType.PSYCHOONCOLOGY_APPOINTMENT]:
    'Cita de psicooncología',
  [PatientTimelineOutcomeType.ALERT]: 'Alerta',
};

const CANCER_STAGE_LABELS: Record<string, string> = {
  STAGE_1: 'I',
  STAGE_2: 'II',
  STAGE_3: 'III',
  STAGE_4: 'IV',
  UNKNOWN: 'desconocido',
};

const TREATMENT_SITUATION_LABELS: Record<string, string> = {
  EN_CURSO: 'en curso',
  PENDIENTE_DE_INICIO: 'pendiente de inicio',
  INTERRUMPIDO: 'interrumpido',
  FINALIZADO: 'finalizado',
};

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  SIS: 'SIS',
  ESSALUD: 'EsSalud',
  EPS: 'EPS',
  FUERZAS_ARMADAS: 'Fuerzas Armadas',
  SALUDPOL: 'SALUDPOL',
  NONE: 'sin seguro',
};

const EPS_PROVIDER_LABELS: Record<string, string> = {
  RIMAC: 'Rímac',
  PACIFICO: 'Pacífico',
  MAPFRE: 'MAPFRE',
  SANITAS: 'Sanitas',
  LA_POSITIVA: 'La Positiva',
  ONCOSALUD: 'Oncosalud',
  OTHER: 'otro proveedor',
};

const ADDRESS_TYPE_LABELS: Record<string, string> = {
  PERMANENT: 'permanente',
  TEMPORARY: 'temporal',
};

const SOCIAL_NOTE_TYPE_LABELS: Record<string, string> = {
  SOCIAL_WORKER: 'Trabajo social',
  CONADIS: 'CONADIS',
  FISSAL: 'FISSAL',
};

const REMINDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'pendiente',
  DONE: 'completado',
  DISMISSED: 'descartado',
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'programada',
  COMPLETED: 'completada',
  CANCELLED: 'cancelada',
  NO_ANSWER: 'sin respuesta',
};

const APPOINTMENT_MODALITY_LABELS: Record<string, string> = {
  CALL: 'llamada',
  VIDEO_CALL: 'videollamada',
};

const ALERT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'activa',
  RESOLVED: 'resuelta',
};

const ALERT_SEVERITY_LABELS: Record<string, string> = {
  HIGH: 'alta',
  MEDIUM: 'media',
  LOW: 'baja',
};

const ALERT_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'general',
  MEDICATION_SHORTAGE: 'falta de medicamento',
  APPOINTMENT_DELAY: 'retraso de cita',
  INSURANCE_COVERAGE: 'cobertura de seguro',
  TRANSPORT: 'transporte',
  ADMINISTRATIVE: 'administrativa',
  PSYCHOSOCIAL: 'psicosocial',
  OTHER: 'otra',
};

const DOSE_UNIT_LABELS: Record<string, string> = {
  MG: 'mg',
  G: 'g',
  ML: 'ml',
  UI: 'UI',
  TABLET: 'tableta(s)',
  DROP: 'gota(s)',
  OTHER: 'otra unidad',
};

const MEDICATION_ROUTE_LABELS: Record<string, string> = {
  ORAL: 'oral',
  IV: 'intravenosa',
  IM: 'intramuscular',
  SUBCUTANEOUS: 'subcutánea',
  TOPICAL: 'tópica',
  OTHER: 'otra vía',
};

@Injectable()
export class PatientTimelineService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: PatientAccessService,
  ) {}

  async get(
    patientId: string,
    query: PatientTimelineQueryDto,
    user: User,
  ): Promise<PatientTimelineResponseDto> {
    await this.access.assertCanRead(patientId, user);

    const projection = this.projectionSql();
    const [rows, totals] = await Promise.all([
      this.dataSource.query<TimelineRow[]>(
        `${projection}
         ORDER BY occurred_at DESC, kind ASC, id DESC
         LIMIT $2 OFFSET $3`,
        [patientId, query.limit, query.offset],
      ),
      this.dataSource.query<Array<{ total: number }>>(
        `SELECT COUNT(*)::int AS total FROM (${projection}) timeline_count`,
        [patientId],
      ),
    ]);
    const outcomes = await this.loadOutcomes(
      rows
        .filter((row) => row.kind === PatientTimelineEventKind.FOLLOW_UP)
        .map((row) => row.follow_up_id)
        .filter((id): id is string => id !== null),
    );

    return {
      data: rows.map((row) => this.toEvent(row, outcomes)),
      total: totals[0]?.total ?? 0,
    };
  }

  private projectionSql(): string {
    return `
      SELECT
        follow_up.id,
        'FOLLOW_UP'::text AS kind,
        COALESCE(
          follow_up.completed_at,
          follow_up.scheduled_at,
          follow_up.created_at
        ) AS occurred_at,
        follow_up.status,
        follow_up.id AS follow_up_id,
        follow_up.type,
        follow_up.purpose,
        follow_up.notes,
        NULL::text AS description,
        NULL::varchar AS modality,
        NULL::int AS session_number,
        NULL::varchar AS social_note_type,
        NULL::text AS social_note,
        NULL::uuid AS author_id
      FROM follow_ups follow_up
      WHERE follow_up.subject_patient_id = $1

      UNION ALL

      SELECT
        reminder.id,
        'REMINDER'::text AS kind,
        reminder.due_at AS occurred_at,
        reminder.status,
        reminder.created_from_follow_up_id AS follow_up_id,
        NULL::varchar AS type,
        NULL::varchar AS purpose,
        NULL::text AS notes,
        reminder.description,
        NULL::varchar AS modality,
        NULL::int AS session_number,
        NULL::varchar AS social_note_type,
        NULL::text AS social_note,
        NULL::uuid AS author_id
      FROM reminders reminder
      WHERE reminder.subject_patient_id = $1

      UNION ALL

      SELECT
        appointment.id,
        'PSYCHOONCOLOGY_APPOINTMENT'::text AS kind,
        appointment.scheduled_at AS occurred_at,
        appointment.status,
        appointment.follow_up_id,
        NULL::varchar AS type,
        NULL::varchar AS purpose,
        NULL::text AS notes,
        NULL::text AS description,
        appointment.modality,
        appointment.session_number,
        NULL::varchar AS social_note_type,
        NULL::text AS social_note,
        NULL::uuid AS author_id
      FROM psychooncology_appointments appointment
      WHERE appointment.patient_id = $1

      UNION ALL

      SELECT
        social_note.id,
        'SOCIAL_NOTE'::text AS kind,
        social_note.created_at AS occurred_at,
        NULL::varchar AS status,
        social_note.follow_up_id,
        NULL::varchar AS type,
        NULL::varchar AS purpose,
        NULL::text AS notes,
        NULL::text AS description,
        NULL::varchar AS modality,
        NULL::int AS session_number,
        social_note.type AS social_note_type,
        social_note.note AS social_note,
        social_note.author_id
      FROM patient_social_notes social_note
      WHERE social_note.patient_id = $1

    `;
  }

  private async loadOutcomes(
    followUpIds: string[],
  ): Promise<Map<string, PatientTimelineOutcomeDto[]>> {
    const outcomes = new Map<string, PatientTimelineOutcomeDto[]>();
    if (!followUpIds.length) return outcomes;

    const rows = await this.dataSource.query<TimelineOutcomeRow[]>(
      this.outcomesSql(),
      [followUpIds],
    );
    for (const row of rows) {
      const current = outcomes.get(row.follow_up_id) ?? [];
      current.push(this.toOutcome(row));
      outcomes.set(row.follow_up_id, current);
    }
    return outcomes;
  }

  private outcomesSql(): string {
    return `
      SELECT
        diagnosis.follow_up_id,
        'DIAGNOSIS'::text AS outcome_type,
        diagnosis.id AS record_id,
        diagnosis.created_at AS occurred_at,
        jsonb_build_object(
          'diagnosis', diagnosis.diagnosis,
          'cancerStage', diagnosis.cancer_stage,
          'diagnosisDate', diagnosis.diagnosis_date,
          'diagnosisSpecialty', diagnosis.diagnosis_specialty,
          'hasMedicalReport', diagnosis.has_medical_report,
          'isCurrent', diagnosis.is_current
        ) AS data
      FROM patient_diagnoses diagnosis
      WHERE diagnosis.follow_up_id = ANY($1::uuid[])

      UNION ALL

      SELECT
        treatment.follow_up_id,
        'TREATMENT'::text AS outcome_type,
        treatment.id AS record_id,
        treatment.created_at AS occurred_at,
        jsonb_build_object(
          'treatmentType', treatment.treatment_type,
          'treatmentSituation', treatment.treatment_situation,
          'startDate', treatment.start_date,
          'endDate', treatment.end_date,
          'isCurrent', treatment.is_current,
          'hasLatestPrescription', treatment.has_latest_prescription,
          'notReceivingReason', treatment.not_receiving_reason
        ) AS data
      FROM patient_treatments treatment
      WHERE treatment.follow_up_id = ANY($1::uuid[])

      UNION ALL

      SELECT
        treatment.follow_up_id,
        'MEDICATION'::text AS outcome_type,
        medication.id AS record_id,
        medication.created_at AS occurred_at,
        jsonb_build_object(
          'name', medication.name,
          'doseAmount', medication.dose_amount,
          'doseUnit', medication.dose_unit,
          'doseDescription', medication.dose_description,
          'route', medication.route,
          'frequencyLabel', medication.frequency_label,
          'startDate', medication.start_date,
          'endDate', medication.end_date,
          'isActive', medication.is_active,
          'notes', medication.notes
        ) AS data
      FROM treatment_medications medication
      INNER JOIN patient_treatments treatment
        ON treatment.id = medication.treatment_id
      WHERE treatment.follow_up_id = ANY($1::uuid[])

      UNION ALL

      SELECT
        symptom.follow_up_id,
        'SYMPTOM'::text AS outcome_type,
        symptom.id AS record_id,
        symptom.created_at AS occurred_at,
        jsonb_build_object(
          'discomfortSeverity', symptom.discomfort_severity,
          'discomfortDescription', symptom.discomfort_description,
          'hasDiscomfort', symptom.has_discomfort,
          'signsAndSymptoms', symptom.signs_and_symptoms,
          'indicationsReceived', symptom.indications_received,
          'isPainPresent', symptom.is_pain_present,
          'painIntensity', symptom.pain_intensity,
          'painLocation', symptom.pain_location,
          'painDescription', symptom.pain_description,
          'hasSoughtMedicalConsultation', symptom.has_sought_medical_consultation,
          'specialty', symptom.specialty
        ) AS data
      FROM patient_symptom_reports symptom
      WHERE symptom.follow_up_id = ANY($1::uuid[])

      UNION ALL

      SELECT
        insurance.follow_up_id,
        'INSURANCE'::text AS outcome_type,
        insurance.id AS record_id,
        insurance.created_at AS occurred_at,
        jsonb_build_object(
          'insuranceType', insurance.insurance_type,
          'epsProvider', insurance.eps_provider,
          'isCurrent', insurance.is_current,
          'changeReason', insurance.change_reason,
          'startDate', insurance.start_date,
          'endDate', insurance.end_date
        ) AS data
      FROM patient_insurance insurance
      WHERE insurance.follow_up_id = ANY($1::uuid[])

      UNION ALL

      SELECT
        sis.follow_up_id,
        'SIS_AFFILIATION'::text AS outcome_type,
        sis.id AS record_id,
        sis.created_at AS occurred_at,
        jsonb_build_object(
          'canAffiliate', sis.can_affiliate,
          'expectedDate', sis.expected_date,
          'cantAffiliateReason', sis.cant_affiliate_reason,
          'affiliatedAt', sis.affiliated_at,
          'comments', sis.comments
        ) AS data
      FROM patient_sis_affiliation sis
      WHERE sis.follow_up_id = ANY($1::uuid[])

      UNION ALL

      SELECT
        address.follow_up_id,
        'ADDRESS'::text AS outcome_type,
        address.id AS record_id,
        address.created_at AS occurred_at,
        jsonb_build_object(
          'type', address.type,
          'isPrimary', address.is_primary,
          'address', address.address,
          'district', address.district,
          'province', address.province,
          'department', address.department,
          'reference', address.reference,
          'dniMatchesAddress', address.dni_matches_address,
          'validFrom', address.valid_from,
          'validTo', address.valid_to,
          'isActive', address.is_active
        ) AS data
      FROM patient_addresses address
      WHERE address.follow_up_id = ANY($1::uuid[])

      UNION ALL

      SELECT
        social_note.follow_up_id,
        'SOCIAL_NOTE'::text AS outcome_type,
        social_note.id AS record_id,
        social_note.created_at AS occurred_at,
        jsonb_build_object(
          'type', social_note.type,
          'note', social_note.note
        ) AS data
      FROM patient_social_notes social_note
      WHERE social_note.follow_up_id = ANY($1::uuid[])

      UNION ALL

      SELECT
        reminder.created_from_follow_up_id,
        'REMINDER'::text AS outcome_type,
        reminder.id AS record_id,
        reminder.due_at AS occurred_at,
        jsonb_build_object(
          'description', reminder.description,
          'status', reminder.status,
          'dueAt', reminder.due_at
        ) AS data
      FROM reminders reminder
      WHERE reminder.created_from_follow_up_id = ANY($1::uuid[])

      UNION ALL

      SELECT
        appointment.follow_up_id,
        'PSYCHOONCOLOGY_APPOINTMENT'::text AS outcome_type,
        appointment.id AS record_id,
        appointment.scheduled_at AS occurred_at,
        jsonb_build_object(
          'status', appointment.status,
          'modality', appointment.modality,
          'sessionNumber', appointment.session_number,
          'scheduledAt', appointment.scheduled_at,
          'completedAt', appointment.completed_at,
          'topicAddressed', appointment.topic_addressed,
          'sessionDetails', appointment.session_details,
          'additionalObservations', appointment.additional_observations,
          'recommendations', appointment.recommendations,
          'referral', appointment.referral
        ) AS data
      FROM psychooncology_appointments appointment
      WHERE appointment.follow_up_id = ANY($1::uuid[])

      UNION ALL

      SELECT
        alert_record.follow_up_id,
        'ALERT'::text AS outcome_type,
        alert_record.id AS record_id,
        alert_record.created_at AS occurred_at,
        jsonb_build_object(
          'title', alert_record.title,
          'description', alert_record.description,
          'status', alert_record.status,
          'severity', alert_record.severity,
          'category', alert_record.category,
          'ticketNumber', alert_record.ticket_number,
          'underReview', alert_record.under_review,
          'derivedTo', alert_record.derived_to,
          'derivationNotes', alert_record.derivation_notes
        ) AS data
      FROM alerts alert_record
      WHERE alert_record.follow_up_id = ANY($1::uuid[])

      ORDER BY follow_up_id, occurred_at DESC, outcome_type ASC, record_id DESC
    `;
  }

  private toOutcome(row: TimelineOutcomeRow): PatientTimelineOutcomeDto {
    const data = row.data;
    const label = OUTCOME_LABELS[row.outcome_type];
    let summary: string;

    switch (row.outcome_type) {
      case PatientTimelineOutcomeType.DIAGNOSIS: {
        const parts = [
          `Diagnóstico registrado: ${text(data, 'diagnosis') ?? 'sin descripción'}`,
          optionalPart(
            'Estadio',
            mapValue(data, 'cancerStage', CANCER_STAGE_LABELS),
          ),
          optionalPart('Especialidad', text(data, 'diagnosisSpecialty')),
          optionalPart('Fecha', dateOnly(data, 'diagnosisDate')),
          `Informe médico: ${boolLabel(data, 'hasMedicalReport', 'disponible', 'no registrado')}`,
          bool(data, 'isCurrent') ? 'Registro vigente' : 'Registro histórico',
        ];
        summary = sentence(parts);
        break;
      }
      case PatientTimelineOutcomeType.TREATMENT: {
        const parts = [
          `Tratamiento registrado: ${text(data, 'treatmentType') ?? 'sin descripción'}`,
          optionalPart(
            'Situación',
            mapValue(data, 'treatmentSituation', TREATMENT_SITUATION_LABELS),
          ),
          periodPart(data, 'startDate', 'endDate'),
          optionalPart(
            'Última prescripción',
            boolLabel(
              data,
              'hasLatestPrescription',
              'registrada',
              'no registrada',
            ),
          ),
          bool(data, 'isCurrent')
            ? 'Tratamiento vigente'
            : 'Registro histórico',
          optionalPart(
            'Motivo de no recepción',
            text(data, 'notReceivingReason'),
          ),
        ];
        summary = sentence(parts);
        break;
      }
      case PatientTimelineOutcomeType.MEDICATION: {
        const dose =
          text(data, 'doseDescription') ??
          dosePart(data, 'doseAmount', 'doseUnit');
        const parts = [
          `Medicamento ${bool(data, 'isActive') ? 'activo' : 'inactivo'}: ${text(data, 'name') ?? 'sin nombre'}`,
          optionalPart('Dosis', dose),
          optionalPart('Vía', mapValue(data, 'route', MEDICATION_ROUTE_LABELS)),
          optionalPart('Frecuencia', text(data, 'frequencyLabel')),
          periodPart(data, 'startDate', 'endDate'),
          optionalPart('Nota', text(data, 'notes')),
        ];
        summary = sentence(parts);
        break;
      }
      case PatientTimelineOutcomeType.SYMPTOM: {
        const description =
          text(data, 'signsAndSymptoms') ??
          text(data, 'discomfortDescription') ??
          text(data, 'painDescription') ??
          'evaluación registrada';
        const pain = bool(data, 'isPainPresent');
        const painDetails = pain
          ? `presente${
              number(data, 'painIntensity') === null
                ? ''
                : ` (${number(data, 'painIntensity')}/10)`
            }${
              text(data, 'painLocation')
                ? ` en ${text(data, 'painLocation')}`
                : ''
            }`
          : pain === false
            ? 'ausente'
            : null;
        const parts = [
          `Síntomas reportados: ${description}`,
          optionalPart('Severidad', text(data, 'discomfortSeverity')),
          optionalPart('Dolor', painDetails),
          optionalPart(
            'Consulta médica',
            boolLabel(
              data,
              'hasSoughtMedicalConsultation',
              'realizada',
              'no registrada',
            ),
          ),
          optionalPart('Especialidad', text(data, 'specialty')),
          optionalPart('Indicaciones', text(data, 'indicationsReceived')),
        ];
        summary = sentence(parts);
        break;
      }
      case PatientTimelineOutcomeType.INSURANCE: {
        const parts = [
          `Cobertura registrada: ${mapValue(data, 'insuranceType', INSURANCE_TYPE_LABELS) ?? 'sin especificar'}`,
          optionalPart(
            'Proveedor EPS',
            mapValue(data, 'epsProvider', EPS_PROVIDER_LABELS),
          ),
          bool(data, 'isCurrent') ? 'Cobertura vigente' : 'Registro histórico',
          periodPart(data, 'startDate', 'endDate'),
          optionalPart('Motivo del cambio', text(data, 'changeReason')),
        ];
        summary = sentence(parts);
        break;
      }
      case PatientTimelineOutcomeType.SIS_AFFILIATION: {
        const parts = [
          `Afiliación al SIS: ${boolLabel(data, 'canAffiliate', 'puede afiliarse', 'no puede afiliarse')}`,
          optionalPart('Fecha esperada', dateOnly(data, 'expectedDate')),
          optionalPart('Motivo', text(data, 'cantAffiliateReason')),
          optionalPart('Afiliado el', dateTime(data, 'affiliatedAt')),
          optionalPart('Comentarios', text(data, 'comments')),
        ];
        summary = sentence(parts);
        break;
      }
      case PatientTimelineOutcomeType.ADDRESS: {
        const location = [
          text(data, 'address'),
          text(data, 'district'),
          text(data, 'province'),
          text(data, 'department'),
        ]
          .filter((value): value is string => value !== null)
          .join(', ');
        const parts = [
          `Dirección ${bool(data, 'isPrimary') ? 'principal' : 'registrada'} (${mapValue(data, 'type', ADDRESS_TYPE_LABELS) ?? 'sin tipo'}): ${location || 'sin detalle'}`,
          `Estado: ${bool(data, 'isActive') ? 'activa' : 'inactiva'}`,
          optionalPart('Referencia', text(data, 'reference')),
          optionalPart(
            'Coincidencia con DNI',
            boolLabel(data, 'dniMatchesAddress', 'sí', 'no'),
          ),
          periodPart(data, 'validFrom', 'validTo'),
        ];
        summary = sentence(parts);
        break;
      }
      case PatientTimelineOutcomeType.SOCIAL_NOTE: {
        summary = sentence([
          `Nota de ${mapValue(data, 'type', SOCIAL_NOTE_TYPE_LABELS) ?? 'seguimiento social'}`,
          truncate(text(data, 'note') ?? 'sin contenido'),
        ]);
        break;
      }
      case PatientTimelineOutcomeType.REMINDER: {
        const status =
          mapValue(data, 'status', REMINDER_STATUS_LABELS) ?? 'registrado';
        summary = sentence([
          `Recordatorio ${status}: ${text(data, 'description') ?? 'sin descripción'}`,
          optionalPart('Vence', dateTime(data, 'dueAt')),
        ]);
        break;
      }
      case PatientTimelineOutcomeType.PSYCHOONCOLOGY_APPOINTMENT: {
        const parts = [
          `Cita de psicooncología ${text(data, 'sessionNumber') ? `(${text(data, 'sessionNumber')}.ª sesión)` : ''} ${mapValue(data, 'status', APPOINTMENT_STATUS_LABELS) ?? 'registrada'}`.trim(),
          optionalPart(
            'Modalidad',
            mapValue(data, 'modality', APPOINTMENT_MODALITY_LABELS),
          ),
          optionalPart('Fecha', dateTime(data, 'scheduledAt')),
          optionalPart('Tema', text(data, 'topicAddressed')),
          optionalPart('Recomendaciones', text(data, 'recommendations')),
          optionalPart('Derivación', text(data, 'referral')),
        ];
        summary = sentence(parts);
        break;
      }
      case PatientTimelineOutcomeType.ALERT: {
        const title = text(data, 'title') ?? 'sin título';
        const parts = [
          `Alerta ${mapValue(data, 'status', ALERT_STATUS_LABELS) ?? 'registrada'}: ${title}`,
          optionalPart(
            'Severidad',
            mapValue(data, 'severity', ALERT_SEVERITY_LABELS),
          ),
          optionalPart(
            'Categoría',
            mapValue(data, 'category', ALERT_CATEGORY_LABELS),
          ),
          optionalPart('Detalle', text(data, 'description')),
          bool(data, 'underReview') ? 'Requiere revisión' : null,
          optionalPart('Derivada a', text(data, 'derivedTo')),
          optionalPart('Nota de derivación', text(data, 'derivationNotes')),
        ];
        summary = sentence(parts);
        break;
      }
      default:
        throw new Error('Unsupported patient timeline outcome type');
    }

    return {
      type: row.outcome_type,
      recordId: row.record_id,
      label,
      summary: truncate(summary),
    };
  }

  private toEvent(
    row: TimelineRow,
    outcomes: ReadonlyMap<string, PatientTimelineOutcomeDto[]>,
  ): PatientTimelineEventDto {
    if (row.kind === PatientTimelineEventKind.SOCIAL_NOTE)
      return {
        id: row.id,
        kind: row.kind,
        occurredAt: new Date(row.occurred_at).toISOString(),
        followUpId: row.follow_up_id!,
        type: row.social_note_type!,
        note: row.social_note!,
        authorId: row.author_id!,
      } as SocialNoteTimelineEventDto;

    const common = {
      id: row.id,
      occurredAt: new Date(row.occurred_at).toISOString(),
      status: row.status,
      followUpId: row.follow_up_id,
    };

    if (row.kind === PatientTimelineEventKind.FOLLOW_UP)
      return {
        ...common,
        kind: row.kind,
        followUpId: row.follow_up_id,
        type: row.type,
        purpose: row.purpose,
        notes: row.notes,
        outcomes: outcomes.get(row.follow_up_id!) ?? [],
      } as FollowUpTimelineEventDto;

    if (row.kind === PatientTimelineEventKind.REMINDER)
      return {
        ...common,
        kind: row.kind,
        description: row.description,
      } as ReminderTimelineEventDto;

    if (row.kind === PatientTimelineEventKind.PSYCHOONCOLOGY_APPOINTMENT)
      return {
        ...common,
        kind: row.kind,
        followUpId: row.follow_up_id,
        modality: row.modality,
        sessionNumber: row.session_number,
      } as PsychooncologyAppointmentTimelineEventDto;

    throw new Error('Unsupported patient timeline event kind');
  }
}

function text(data: OutcomeData, key: string): string | null {
  const value = data[key];
  if (value === null || value === undefined) return null;
  const raw =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? `${value}`
        : typeof value === 'bigint' || typeof value === 'symbol'
          ? value.toString()
          : (JSON.stringify(value) ?? '');
  const normalized = raw.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function number(data: OutcomeData, key: string): number | null {
  const value = data[key];
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(data: OutcomeData, key: string): boolean | null {
  const value = data[key];
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function boolLabel(
  data: OutcomeData,
  key: string,
  trueLabel: string,
  falseLabel: string,
): string | null {
  const value = bool(data, key);
  return value === null ? null : value ? trueLabel : falseLabel;
}

function mapValue(
  data: OutcomeData,
  key: string,
  labels: Record<string, string>,
): string | null {
  const value = text(data, key);
  return value ? (labels[value] ?? value) : null;
}

function optionalPart(label: string, value: string | null): string | null {
  return value ? `${label}: ${value}` : null;
}

function periodPart(
  data: OutcomeData,
  startKey: string,
  endKey: string,
): string | null {
  const start = dateOnly(data, startKey);
  const end = dateOnly(data, endKey);
  if (!start && !end) return null;
  if (start && end) return `Periodo: ${start} a ${end}`;
  return `Fecha: ${start ?? end}`;
}

function dosePart(
  data: OutcomeData,
  amountKey: string,
  unitKey: string,
): string | null {
  const amount = text(data, amountKey);
  const unit = mapValue(data, unitKey, DOSE_UNIT_LABELS);
  if (!amount && !unit) return null;
  return [amount, unit]
    .filter((value): value is string => value !== null)
    .join(' ');
}

function dateOnly(data: OutcomeData, key: string): string | null {
  const value = text(data, key);
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function dateTime(data: OutcomeData, key: string): string | null {
  const value = text(data, key);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  const parts = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}

function sentence(parts: Array<string | null>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .join('. ')
    .replace(/\.+$/, '');
}

function truncate(value: string, maxLength = 280): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}
