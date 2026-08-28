import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DashboardPeriod, DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  DashboardDistributionItemDto,
  DashboardResponseDto,
  DashboardTableItemDto,
  DashboardTrendPointDto,
} from './dto/dashboard-response.dto';

const TIMEZONE = 'America/Lima';
const OTHER_LABEL = 'Otros';
const UNKNOWN_LABEL = 'Sin informacion';

interface PeriodBounds {
  startAt: string;
  endAt: string;
  startDate: string;
  trendEndDate: string;
}

interface SummaryRow {
  enrollmentEvents: string | number;
  cohortPatients: string | number;
  activePatients: string | number;
  inactivePatients: string | number;
  deceasedPatients: string | number;
  dropoutPatients: string | number;
  sessions: string | number;
  completedSessions: string | number;
}

interface DistributionRow {
  category: 'gender' | 'diagnoses' | 'treatments' | 'cancerStages';
  label: string;
  count: string | number;
}

interface TrendRow {
  period: string;
  enrollmentEvents: string | number;
  sessions: string | number;
  completedSessions: string | number;
}

interface TableRow {
  category: 'hospitals' | 'regions' | 'referrals';
  name: string;
  count: string | number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async getDashboard(query: DashboardQueryDto): Promise<DashboardResponseDto> {
    const bounds = this.getBounds(query);
    const parameters = [bounds.startAt, bounds.endAt];
    const [summaryRows, trendRows, distributionRows, tableRows] =
      await Promise.all([
        this.dataSource.query<SummaryRow[]>(this.summaryQuery(), parameters),
        this.dataSource.query<TrendRow[]>(this.trendQuery(query.period), [
          ...parameters,
          bounds.startDate,
          bounds.trendEndDate,
        ]),
        this.dataSource.query<DistributionRow[]>(
          this.distributionsQuery(),
          parameters,
        ),
        this.dataSource.query<TableRow[]>(this.tablesQuery(), parameters),
      ]);
    const summary = summaryRows[0];
    const sessions = this.toNumber(summary.sessions);
    const completedSessions = this.toNumber(summary.completedSessions);

    return {
      meta: {
        period: query.period,
        year: query.year,
        month: query.period === DashboardPeriod.MONTH ? query.month! : null,
        timezone: TIMEZONE,
        startsAt: bounds.startAt,
        endsAt: bounds.endAt,
      },
      summary: {
        enrollmentEvents: this.toNumber(summary.enrollmentEvents),
        cohortPatients: this.toNumber(summary.cohortPatients),
        activePatients: this.toNumber(summary.activePatients),
        inactivePatients: this.toNumber(summary.inactivePatients),
        deceasedPatients: this.toNumber(summary.deceasedPatients),
        dropoutPatients: this.toNumber(summary.dropoutPatients),
        sessions,
        completedSessions,
        completionRate:
          sessions === 0
            ? 0
            : Number(((completedSessions / sessions) * 100).toFixed(2)),
      },
      distributions: this.toDistributions(distributionRows),
      trend: trendRows.map((row) => this.toTrendPoint(row)),
      hospitals: this.toTables(tableRows, 'hospitals'),
      regions: this.toTables(tableRows, 'regions'),
      referrals: this.toTables(tableRows, 'referrals'),
    };
  }

  private getBounds(query: DashboardQueryDto): PeriodBounds {
    const month = query.period === DashboardPeriod.MONTH ? query.month! : 1;
    const startDate = this.dateString(query.year, month);
    const next =
      query.period === DashboardPeriod.MONTH
        ? this.dateString(query.year, month + 1)
        : this.dateString(query.year + 1, 1);

    return {
      startAt: `${startDate}T05:00:00.000Z`,
      endAt: `${next}T05:00:00.000Z`,
      startDate,
      trendEndDate:
        query.period === DashboardPeriod.MONTH
          ? new Date(Date.UTC(query.year, month, 0)).toISOString().slice(0, 10)
          : this.dateString(query.year, 12),
    };
  }

  private dateString(year: number, month: number): string {
    const date = new Date(Date.UTC(year, month - 1, 1));
    return date.toISOString().slice(0, 10);
  }

  private toDistributions(
    rows: DistributionRow[],
  ): DashboardResponseDto['distributions'] {
    const itemsFor = (category: DistributionRow['category']) =>
      this.withOther(
        rows
          .filter((row) => row.category === category)
          .map((row) => ({
            label: row.label,
            count: this.toNumber(row.count),
          })),
      );

    return {
      gender: itemsFor('gender'),
      diagnoses: itemsFor('diagnoses'),
      treatments: itemsFor('treatments'),
      cancerStages: itemsFor('cancerStages'),
    };
  }

  private withOther(
    items: DashboardDistributionItemDto[],
  ): DashboardDistributionItemDto[] {
    const top = items.slice(0, 6);
    const otherCount = items
      .slice(6)
      .reduce((total, item) => total + item.count, 0);
    return otherCount === 0
      ? top
      : [...top, { label: OTHER_LABEL, count: otherCount }];
  }

  private toTrendPoint(row: TrendRow): DashboardTrendPointDto {
    return {
      period: row.period,
      enrollmentEvents: this.toNumber(row.enrollmentEvents),
      sessions: this.toNumber(row.sessions),
      completedSessions: this.toNumber(row.completedSessions),
    };
  }

  private toTables(
    rows: TableRow[],
    category: TableRow['category'],
  ): DashboardTableItemDto[] {
    return rows
      .filter((row) => row.category === category)
      .slice(0, 8)
      .map((row) => ({ name: row.name, count: this.toNumber(row.count) }));
  }

  private toNumber(value: string | number): number {
    return Number(value);
  }

  private summaryQuery(): string {
    return `
      WITH cohort AS (
        SELECT DISTINCT enrollment.patient_id
        FROM enrollments enrollment
        WHERE enrollment.created_at >= $1 AND enrollment.created_at < $2
      )
      SELECT
        (SELECT COUNT(*) FROM enrollments WHERE created_at >= $1 AND created_at < $2) AS "enrollmentEvents",
        COUNT(*) AS "cohortPatients",
        COUNT(*) FILTER (WHERE patient.activity_status IN ('ACTIVE', 'REACTIVE')) AS "activePatients",
        COUNT(*) FILTER (WHERE patient.activity_status = 'INACTIVE') AS "inactivePatients",
        COUNT(*) FILTER (WHERE patient.deceased_at IS NOT NULL OR patient.deactivation_reason = 'DECEASED') AS "deceasedPatients",
        COUNT(*) FILTER (WHERE patient.activity_status = 'INACTIVE' AND patient.deceased_at IS NULL AND patient.deactivation_reason IS DISTINCT FROM 'DECEASED') AS "dropoutPatients",
        (SELECT COUNT(*) FROM psychooncology_appointments WHERE scheduled_at >= $1 AND scheduled_at < $2) AS "sessions",
        (SELECT COUNT(*) FROM psychooncology_appointments WHERE scheduled_at >= $1 AND scheduled_at < $2 AND status = 'COMPLETED') AS "completedSessions"
      FROM cohort
      JOIN patients patient ON patient.id = cohort.patient_id
    `;
  }

  private trendQuery(period: DashboardPeriod): string {
    const interval = period === DashboardPeriod.MONTH ? 'day' : 'month';
    const label = period === DashboardPeriod.MONTH ? 'YYYY-MM-DD' : 'YYYY-MM';
    const bucket =
      period === DashboardPeriod.MONTH
        ? `(created_at AT TIME ZONE '${TIMEZONE}')::date`
        : `date_trunc('month', created_at AT TIME ZONE '${TIMEZONE}')::date`;
    const appointmentBucket =
      period === DashboardPeriod.MONTH
        ? `(scheduled_at AT TIME ZONE '${TIMEZONE}')::date`
        : `date_trunc('month', scheduled_at AT TIME ZONE '${TIMEZONE}')::date`;

    return `
      WITH enrollment_counts AS (
        SELECT ${bucket} AS bucket, COUNT(*) AS count
        FROM enrollments
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY bucket
      ), session_counts AS (
        SELECT ${appointmentBucket} AS bucket,
          COUNT(*) AS sessions,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') AS "completedSessions"
        FROM psychooncology_appointments
        WHERE scheduled_at >= $1 AND scheduled_at < $2
        GROUP BY bucket
      )
      SELECT
        to_char(series.bucket, '${label}') AS period,
        COALESCE(enrollment_counts.count, 0) AS "enrollmentEvents",
        COALESCE(session_counts.sessions, 0) AS sessions,
        COALESCE(session_counts."completedSessions", 0) AS "completedSessions"
      FROM generate_series($3::date, $4::date, interval '1 ${interval}') AS series(bucket)
      LEFT JOIN enrollment_counts ON enrollment_counts.bucket = series.bucket
      LEFT JOIN session_counts ON session_counts.bucket = series.bucket
      ORDER BY series.bucket
    `;
  }

  private distributionsQuery(): string {
    return `
      WITH cohort AS (
        SELECT DISTINCT patient_id FROM enrollments
        WHERE created_at >= $1 AND created_at < $2
      ), current_diagnoses AS (
        SELECT patient_id, diagnosis, cancer_stage, id
        FROM patient_diagnoses
        WHERE is_current = true
      ), current_treatments AS (
        SELECT treatment.patient_id, treatment.diagnosis_id, treatment.treatment_type
        FROM patient_treatments treatment
        WHERE treatment.is_current = true
      )
      SELECT category, label, COUNT(*) AS count
      FROM (
        SELECT 'gender' AS category, COALESCE(NULLIF(BTRIM(patient.gender), ''), '${UNKNOWN_LABEL}') AS label
        FROM cohort JOIN patients patient ON patient.id = cohort.patient_id
        UNION ALL
        SELECT 'diagnoses', COALESCE(NULLIF(BTRIM(diagnosis.diagnosis), ''), '${UNKNOWN_LABEL}')
        FROM cohort
        JOIN patients patient ON patient.id = cohort.patient_id
        LEFT JOIN current_diagnoses diagnosis ON diagnosis.patient_id = patient.id
        UNION ALL
        SELECT 'treatments', COALESCE(NULLIF(BTRIM(treatment.treatment_type), ''), '${UNKNOWN_LABEL}')
        FROM cohort
        JOIN patients patient ON patient.id = cohort.patient_id
        LEFT JOIN current_diagnoses diagnosis ON diagnosis.patient_id = patient.id
        LEFT JOIN current_treatments treatment ON treatment.diagnosis_id = diagnosis.id
        UNION ALL
        SELECT 'cancerStages', COALESCE(diagnosis.cancer_stage, '${UNKNOWN_LABEL}')
        FROM cohort
        JOIN patients patient ON patient.id = cohort.patient_id
        LEFT JOIN current_diagnoses diagnosis ON diagnosis.patient_id = patient.id
      ) values
      GROUP BY category, label
      ORDER BY category, count DESC, label ASC
    `;
  }

  private tablesQuery(): string {
    return `
      WITH cohort AS (
        SELECT DISTINCT patient_id FROM enrollments
        WHERE created_at >= $1 AND created_at < $2
      ), latest_current_diagnoses AS (
        SELECT DISTINCT ON (patient_id) patient_id, health_center_id
        FROM patient_diagnoses
        WHERE is_current = true
        ORDER BY patient_id, created_at DESC, id DESC
      ), current_treatments AS (
        SELECT DISTINCT ON (treatment.patient_id)
          treatment.patient_id,
          treatment.receiving_health_center_id
        FROM patient_treatments treatment
        WHERE treatment.is_current = true
        ORDER BY treatment.patient_id, treatment.created_at DESC, treatment.id DESC
      ), latest_current_appointments AS (
        SELECT DISTINCT ON (patient_id) patient_id, health_center_id
        FROM patient_medical_appointments
        WHERE is_current = true
        ORDER BY patient_id, appointment_date DESC NULLS LAST, created_at DESC, id DESC
      ), primary_addresses AS (
        SELECT DISTINCT ON (patient_id) patient_id, department
        FROM patient_addresses
        WHERE is_primary = true AND is_active = true
        ORDER BY patient_id, created_at DESC, id DESC
      ), patient_context AS (
        SELECT
          patient.id,
          details.primary_health_center_id,
           COALESCE(appointment.health_center_id, treatment.receiving_health_center_id, diagnosis.health_center_id) AS fallback_health_center_id,
          address.department AS current_department,
          details.birth_department
        FROM cohort
        JOIN patients patient ON patient.id = cohort.patient_id
        LEFT JOIN patient_details details ON details.patient_id = patient.id
        LEFT JOIN latest_current_diagnoses diagnosis ON diagnosis.patient_id = patient.id
        LEFT JOIN current_treatments treatment ON treatment.patient_id = patient.id
        LEFT JOIN latest_current_appointments appointment ON appointment.patient_id = patient.id
        LEFT JOIN primary_addresses address ON address.patient_id = patient.id
      )
      SELECT category, name, COUNT(*) AS count
      FROM (
        SELECT 'hospitals' AS category, COALESCE(primary_health_center.name, fallback_health_center.name, '${UNKNOWN_LABEL}') AS name
        FROM patient_context
        LEFT JOIN health_centers primary_health_center ON primary_health_center.id = patient_context.primary_health_center_id
        LEFT JOIN health_centers fallback_health_center ON fallback_health_center.id = patient_context.fallback_health_center_id
        UNION ALL
         SELECT 'regions', COALESCE(NULLIF(BTRIM(patient_context.current_department), ''), '${UNKNOWN_LABEL}')
         FROM patient_context
        UNION ALL
        SELECT 'referrals', COALESCE(from_center.name, '${UNKNOWN_LABEL}') || ' → ' || COALESCE(to_center.name, '${UNKNOWN_LABEL}')
        FROM patient_treatments treatment
        JOIN cohort ON cohort.patient_id = treatment.patient_id
        LEFT JOIN health_centers from_center ON from_center.id = treatment.source_health_center_id
        LEFT JOIN health_centers to_center ON to_center.id = treatment.receiving_health_center_id
        WHERE treatment.is_referred = true AND treatment.is_current = true
      ) values
      GROUP BY category, name
      ORDER BY category, count DESC, name ASC
    `;
  }
}
