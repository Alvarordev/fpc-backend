import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DashboardPeriod } from './dto/dashboard-query.dto';
import { DashboardIndicatorQueryDto } from './dto/dashboard-indicator-query.dto';
import {
  DashboardDemographicsResponseDto,
  DashboardEpidemiologyResponseDto,
  DashboardIndicatorDistributionDto,
  DashboardIndicatorMetaDto,
} from './dto/dashboard-indicator-response.dto';

const TIMEZONE = 'America/Lima';
const UNKNOWN_LABEL = 'Sin informacion';
const NOT_APPLICABLE_LABEL = 'No aplica';

interface IndicatorBounds {
  fromAt: string;
  toAt: string;
  fromDate: string;
  toDate: string;
}

interface DistributionRow {
  category: string;
  label: string;
  count: string | number;
  known: string | number;
  unknown: string | number;
}

interface EventRow {
  category: 'deaths' | 'diagnosticConfirmed' | 'diagnosticRuledOut';
  count: string | number;
}

interface PopulationRow {
  count: string | number;
}

@Injectable()
export class DashboardIndicatorsService {
  constructor(private readonly dataSource: DataSource) {}

  async getDemographics(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardDemographicsResponseDto> {
    const bounds = this.getBounds(query);
    const parameters = [bounds.fromAt, bounds.toAt, bounds.toDate];
    const [populationRows, distributionRows] = await Promise.all([
      this.dataSource.query<PopulationRow[]>(
        this.populationQuery(),
        parameters.slice(0, 2),
      ),
      this.dataSource.query<DistributionRow[]>(
        this.demographicsQuery(),
        parameters,
      ),
    ]);
    const populationCount = this.toNumber(populationRows[0]?.count ?? 0);
    const distributions = this.toDistributions(distributionRows);

    return {
      meta: this.meta(
        bounds,
        populationCount,
        'Distribucion demografica de la cohorte de pacientes enrolados en el periodo.',
      ),
      age: distributions.age,
      gender: distributions.gender,
      district: distributions.district,
      province: distributions.province,
      department: distributions.department,
      zoneType: distributions.zoneType,
      educationLevel: distributions.educationLevel,
      nativeLanguage: distributions.nativeLanguage,
      requiresTranslation: distributions.requiresTranslation,
      isWorking: distributions.isWorking,
      insuranceType: distributions.insuranceType,
      epsProvider: distributions.epsProvider,
    };
  }

  async getEpidemiology(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardEpidemiologyResponseDto> {
    const bounds = this.getBounds(query);
    const populationParameters = [bounds.fromAt, bounds.toAt];
    const eventParameters = [
      bounds.fromAt,
      bounds.toAt,
      bounds.fromDate,
      bounds.toDate,
    ];
    const [populationRows, distributionRows, eventRows] = await Promise.all([
      this.dataSource.query<PopulationRow[]>(
        this.populationQuery(),
        populationParameters,
      ),
      this.dataSource.query<DistributionRow[]>(
        this.epidemiologyQuery(),
        populationParameters,
      ),
      this.dataSource.query<EventRow[]>(this.eventsQuery(), eventParameters),
    ]);
    const populationCount = this.toNumber(populationRows[0]?.count ?? 0);
    const distributions = this.toDistributions(distributionRows);
    const events = {
      deaths: 0,
      diagnosticConfirmed: 0,
      diagnosticRuledOut: 0,
    };
    for (const row of eventRows)
      events[row.category] = this.toNumber(row.count);

    return {
      meta: this.meta(
        bounds,
        populationCount,
        'Estado epidemiologico actual de la cohorte y eventos efectivos del periodo.',
      ),
      currentDiagnoses: distributions.currentDiagnoses,
      currentCancerStages: distributions.currentCancerStages,
      currentTreatmentTypes: distributions.currentTreatmentTypes,
      currentTreatmentSituations: distributions.currentTreatmentSituations,
      currentDiagnosticStatuses: distributions.currentDiagnosticStatuses,
      events,
    };
  }

  private getBounds(query: DashboardIndicatorQueryDto): IndicatorBounds {
    if (query.from || query.to) {
      if (!query.from || !query.to)
        throw new BadRequestException(
          'from and to must be provided together for dashboard indicators',
        );
      if (query.period || query.year || query.month)
        throw new BadRequestException(
          'Use either from/to or period/year/month for dashboard indicators',
        );
      if (query.from >= query.to)
        throw new BadRequestException('from must be before to');
      return this.boundsFromDates(query.from, query.to);
    }

    if (!query.period || query.year === undefined)
      throw new BadRequestException(
        'Provide period/year/month or from/to for dashboard indicators',
      );
    if (query.period === DashboardPeriod.MONTH && query.month === undefined)
      throw new BadRequestException(
        'month is required when period=month for dashboard indicators',
      );
    if (query.period === DashboardPeriod.YEAR && query.month !== undefined)
      throw new BadRequestException(
        'month is only allowed when period=month for dashboard indicators',
      );

    const month = query.period === DashboardPeriod.MONTH ? query.month! : 1;
    const fromDate = this.dateString(query.year, month);
    const toDate =
      query.period === DashboardPeriod.MONTH
        ? this.dateString(query.year, month + 1)
        : this.dateString(query.year + 1, 1);
    return this.boundsFromDates(fromDate, toDate);
  }

  private boundsFromDates(fromDate: string, toDate: string): IndicatorBounds {
    return {
      fromAt: `${fromDate}T05:00:00.000Z`,
      toAt: `${toDate}T05:00:00.000Z`,
      fromDate,
      toDate,
    };
  }

  private dateString(year: number, month: number): string {
    return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  }

  private meta(
    bounds: IndicatorBounds,
    populationCount: number,
    definition: string,
  ): DashboardIndicatorMetaDto {
    return {
      from: bounds.fromDate,
      to: bounds.toDate,
      timezone: TIMEZONE,
      definition,
      population:
        'Pacientes distintos con un enrolamiento creado en el periodo seleccionado.',
      populationCount,
    };
  }

  private toDistributions(rows: DistributionRow[]) {
    const categories = new Map<string, DashboardIndicatorDistributionDto>();
    for (const row of rows) {
      let distribution = categories.get(row.category);
      if (!distribution) {
        const known = this.toNumber(row.known);
        const unknown = this.toNumber(row.unknown);
        distribution = {
          items: [],
          known,
          unknown,
          population: known + unknown,
          coveragePct: this.coverage(known, unknown),
        };
        categories.set(row.category, distribution);
      }
      distribution.items.push({
        label: row.label,
        count: this.toNumber(row.count),
      });
    }
    const distributions: Record<string, DashboardIndicatorDistributionDto> = {};
    for (const category of [
      'age',
      'gender',
      'district',
      'province',
      'department',
      'zoneType',
      'educationLevel',
      'nativeLanguage',
      'requiresTranslation',
      'isWorking',
      'insuranceType',
      'epsProvider',
      'currentDiagnoses',
      'currentCancerStages',
      'currentTreatmentTypes',
      'currentTreatmentSituations',
      'currentDiagnosticStatuses',
    ])
      distributions[category] =
        categories.get(category) ?? this.emptyDistribution();
    return distributions;
  }

  private emptyDistribution(): DashboardIndicatorDistributionDto {
    return { items: [], known: 0, unknown: 0, population: 0, coveragePct: 0 };
  }

  private coverage(known: number, unknown: number): number {
    const population = known + unknown;
    return population === 0
      ? 0
      : Number(((known / population) * 100).toFixed(2));
  }

  private toNumber(value: string | number): number {
    return Number(value);
  }

  private populationQuery(): string {
    return `
      SELECT COUNT(DISTINCT enrollment.patient_id) AS count
      FROM enrollments enrollment
      JOIN patients patient ON patient.id = enrollment.patient_id
      WHERE patient.role = 'PATIENT'
        AND enrollment.created_at >= $1
        AND enrollment.created_at < $2
    `;
  }

  private demographicsQuery(): string {
    return `
      WITH cohort AS (
        SELECT DISTINCT enrollment.patient_id
        FROM enrollments enrollment
        JOIN patients patient ON patient.id = enrollment.patient_id
        WHERE patient.role = 'PATIENT'
          AND enrollment.created_at >= $1
          AND enrollment.created_at < $2
      ), primary_addresses AS (
        SELECT DISTINCT ON (address.patient_id)
          address.patient_id, address.district, address.province, address.department
        FROM patient_addresses address
        JOIN cohort ON cohort.patient_id = address.patient_id
        WHERE address.is_primary = true AND address.is_active = true
        ORDER BY address.patient_id, address.created_at DESC, address.id DESC
      ), current_insurance AS (
        SELECT DISTINCT ON (insurance.patient_id)
          insurance.patient_id, insurance.insurance_type, insurance.eps_provider
        FROM patient_insurance insurance
        JOIN cohort ON cohort.patient_id = insurance.patient_id
        WHERE insurance.is_current = true
        ORDER BY insurance.patient_id, insurance.created_at DESC, insurance.id DESC
      ), patient_values AS (
        SELECT
          patient.id,
          patient.birth_date,
          patient.gender,
          details.zone_type,
          details.education_level,
          details.native_language,
          details.requires_translation,
          details.is_working,
          address.district,
          address.province,
          address.department,
          insurance.insurance_type,
          insurance.eps_provider,
          EXTRACT(YEAR FROM age(($3::date - INTERVAL '1 day')::date, patient.birth_date))::integer AS age_years
        FROM cohort
        JOIN patients patient ON patient.id = cohort.patient_id
        LEFT JOIN patient_details details ON details.patient_id = patient.id
        LEFT JOIN primary_addresses address ON address.patient_id = patient.id
        LEFT JOIN current_insurance insurance ON insurance.patient_id = patient.id
      ), values AS (
        SELECT 'age' AS category,
          CASE
            WHEN birth_date IS NULL THEN '${UNKNOWN_LABEL}'
            WHEN age_years < 18 THEN 'Menor de 18'
            WHEN age_years BETWEEN 18 AND 29 THEN '18-29'
            WHEN age_years BETWEEN 30 AND 44 THEN '30-44'
            WHEN age_years BETWEEN 45 AND 59 THEN '45-59'
            ELSE '60+'
          END AS label
        FROM patient_values
        UNION ALL SELECT 'gender', COALESCE(NULLIF(BTRIM(gender), ''), '${UNKNOWN_LABEL}') FROM patient_values
        UNION ALL SELECT 'district', COALESCE(NULLIF(BTRIM(district), ''), '${UNKNOWN_LABEL}') FROM patient_values
        UNION ALL SELECT 'province', COALESCE(NULLIF(BTRIM(province), ''), '${UNKNOWN_LABEL}') FROM patient_values
        UNION ALL SELECT 'department', COALESCE(NULLIF(BTRIM(department), ''), '${UNKNOWN_LABEL}') FROM patient_values
        UNION ALL SELECT 'zoneType', COALESCE(NULLIF(BTRIM(zone_type), ''), '${UNKNOWN_LABEL}') FROM patient_values
        UNION ALL SELECT 'educationLevel', COALESCE(NULLIF(BTRIM(education_level), ''), '${UNKNOWN_LABEL}') FROM patient_values
        UNION ALL SELECT 'nativeLanguage', COALESCE(NULLIF(BTRIM(native_language), ''), '${UNKNOWN_LABEL}') FROM patient_values
        UNION ALL SELECT 'requiresTranslation',
          CASE WHEN requires_translation IS NULL THEN '${UNKNOWN_LABEL}' WHEN requires_translation THEN 'Si' ELSE 'No' END
        FROM patient_values
        UNION ALL SELECT 'isWorking',
          CASE WHEN is_working IS NULL THEN '${UNKNOWN_LABEL}' WHEN is_working THEN 'Si' ELSE 'No' END
        FROM patient_values
        UNION ALL SELECT 'insuranceType', COALESCE(NULLIF(BTRIM(insurance_type), ''), '${UNKNOWN_LABEL}') FROM patient_values
        UNION ALL SELECT 'epsProvider',
          CASE
            WHEN insurance_type IS NULL THEN '${UNKNOWN_LABEL}'
            WHEN insurance_type <> 'EPS' THEN '${NOT_APPLICABLE_LABEL}'
            ELSE COALESCE(NULLIF(BTRIM(eps_provider), ''), '${UNKNOWN_LABEL}')
          END
        FROM patient_values
      ), counts AS (
        SELECT category, label, COUNT(*) AS count
        FROM values
        GROUP BY category, label
      )
      SELECT category, label, count,
        SUM(count) FILTER (WHERE label NOT IN ('${UNKNOWN_LABEL}', '${NOT_APPLICABLE_LABEL}')) OVER (PARTITION BY category) AS known,
        SUM(count) FILTER (WHERE label = '${UNKNOWN_LABEL}') OVER (PARTITION BY category) AS unknown
      FROM counts
      ORDER BY category, count DESC, label ASC
    `;
  }

  private epidemiologyQuery(): string {
    return `
      WITH cohort AS (
        SELECT DISTINCT enrollment.patient_id
        FROM enrollments enrollment
        JOIN patients patient ON patient.id = enrollment.patient_id
        WHERE patient.role = 'PATIENT'
          AND enrollment.created_at >= $1
          AND enrollment.created_at < $2
      ), current_diagnoses AS (
        SELECT DISTINCT ON (diagnosis.patient_id)
          diagnosis.patient_id, diagnosis.diagnosis, diagnosis.cancer_stage
        FROM patient_diagnoses diagnosis
        JOIN cohort ON cohort.patient_id = diagnosis.patient_id
        WHERE diagnosis.is_current = true
        ORDER BY diagnosis.patient_id, diagnosis.created_at DESC, diagnosis.id DESC
      ), current_treatments AS (
        SELECT DISTINCT ON (treatment.patient_id)
          treatment.patient_id, treatment.treatment_type, treatment.treatment_situation
        FROM patient_treatments treatment
        JOIN cohort ON cohort.patient_id = treatment.patient_id
        WHERE treatment.is_current = true
        ORDER BY treatment.patient_id, treatment.created_at DESC, treatment.id DESC
      ), current_statuses AS (
        SELECT DISTINCT ON (status.patient_id)
          status.patient_id, status.status
        FROM patient_diagnostic_status_events status
        JOIN cohort ON cohort.patient_id = status.patient_id
        ORDER BY status.patient_id, status.occurred_at DESC, status.created_at DESC, status.id DESC
      ), values AS (
        SELECT 'currentDiagnoses' AS category, COALESCE(NULLIF(BTRIM(diagnosis.diagnosis), ''), '${UNKNOWN_LABEL}') AS label
        FROM cohort LEFT JOIN current_diagnoses diagnosis ON diagnosis.patient_id = cohort.patient_id
        UNION ALL SELECT 'currentCancerStages', COALESCE(NULLIF(BTRIM(diagnosis.cancer_stage), ''), '${UNKNOWN_LABEL}')
        FROM cohort LEFT JOIN current_diagnoses diagnosis ON diagnosis.patient_id = cohort.patient_id
        UNION ALL SELECT 'currentTreatmentTypes', COALESCE(NULLIF(BTRIM(treatment.treatment_type), ''), '${UNKNOWN_LABEL}')
        FROM cohort LEFT JOIN current_treatments treatment ON treatment.patient_id = cohort.patient_id
        UNION ALL SELECT 'currentTreatmentSituations', COALESCE(NULLIF(BTRIM(treatment.treatment_situation), ''), '${UNKNOWN_LABEL}')
        FROM cohort LEFT JOIN current_treatments treatment ON treatment.patient_id = cohort.patient_id
        UNION ALL SELECT 'currentDiagnosticStatuses', COALESCE(NULLIF(BTRIM(status.status), ''), '${UNKNOWN_LABEL}')
        FROM cohort LEFT JOIN current_statuses status ON status.patient_id = cohort.patient_id
      ), counts AS (
        SELECT category, label, COUNT(*) AS count
        FROM values
        GROUP BY category, label
      )
      SELECT category, label, count,
        SUM(count) FILTER (WHERE label <> '${UNKNOWN_LABEL}') OVER (PARTITION BY category) AS known,
        SUM(count) FILTER (WHERE label = '${UNKNOWN_LABEL}') OVER (PARTITION BY category) AS unknown
      FROM counts
      ORDER BY category, count DESC, label ASC
    `;
  }

  private eventsQuery(): string {
    return `
      SELECT category, count FROM (
        SELECT 'deaths' AS category, COUNT(DISTINCT patient.id) AS count
        FROM patients patient
        WHERE patient.role = 'PATIENT'
          AND (
            (patient.deceased_at >= $3::date AND patient.deceased_at < $4::date)
            OR (
              patient.deceased_at IS NULL
              AND patient.deactivation_reason = 'DECEASED'
              AND patient.deactivated_at >= $1
              AND patient.deactivated_at < $2
            )
          )
        UNION ALL
        SELECT 'diagnosticConfirmed', COUNT(DISTINCT event.patient_id)
        FROM patient_diagnostic_status_events event
        WHERE event.status = 'CONFIRMED'
          AND event.occurred_at >= $1 AND event.occurred_at < $2
        UNION ALL
        SELECT 'diagnosticRuledOut', COUNT(DISTINCT event.patient_id)
        FROM patient_diagnostic_status_events event
        WHERE event.status = 'RULED_OUT'
          AND event.occurred_at >= $1 AND event.occurred_at < $2
      ) events
    `;
  }
}
