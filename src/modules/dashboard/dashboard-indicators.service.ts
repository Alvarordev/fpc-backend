import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DashboardPeriod } from './dto/dashboard-query.dto';
import { DashboardIndicatorQueryDto } from './dto/dashboard-indicator-query.dto';
import {
  DashboardAbandonmentResponseDto,
  DashboardAdherenceResponseDto,
  DashboardDemographicsResponseDto,
  DashboardEpidemiologyResponseDto,
  DashboardIndicatorDistributionDto,
  DashboardIndicatorMetaDto,
  DashboardManagementResponseDto,
  DashboardProductivityResponseDto,
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

interface MetricRow {
  metric: string;
  value: string | number | null;
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


  async getManagement(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardManagementResponseDto> {
    const bounds = this.getBounds(query);
    const populationParameters = [bounds.fromAt, bounds.toAt];
    const eventParameters = [
      bounds.fromAt,
      bounds.toAt,
      bounds.fromDate,
      bounds.toDate,
    ];
    const [populationRows, metricRows, distributionRows] = await Promise.all([
      this.dataSource.query<PopulationRow[]>(
        this.populationQuery(),
        populationParameters,
      ),
      this.dataSource.query<MetricRow[]>(
        this.managementMetricsQuery(),
        eventParameters,
      ),
      this.dataSource.query<DistributionRow[]>(
        this.managementDistributionsQuery(),
        populationParameters,
      ),
    ]);
    const populationCount = this.toNumber(populationRows[0]?.count ?? 0);
    const metrics = this.toMetrics(metricRows);
    const distributions = this.toDistributions(distributionRows, [
      'specialtyForDiagnosis',
      'transportationSepaProviders',
      'shelterSepaProviders',
    ]);

    return {
      meta: this.meta(
        bounds,
        populationCount,
        'Indicadores de gestion SEPA sobre la cohorte enrolada en el periodo.',
      ),
      sisAffiliatedViaSepa: metrics.sisAffiliatedViaSepa ?? 0,
      essaludAffiliatedViaSepa: metrics.essaludAffiliatedViaSepa ?? 0,
      primaryCareViaSepa: metrics.primaryCareViaSepa ?? 0,
      referredViaSepa: metrics.referredViaSepa ?? 0,
      specialtyForDiagnosis: distributions.specialtyForDiagnosis,
      diagnosticRuledOutViaSepa: metrics.diagnosticRuledOutViaSepa ?? 0,
      diagnosticConfirmedViaSepa: metrics.diagnosticConfirmedViaSepa ?? 0,
      treatmentViaSepa: metrics.treatmentViaSepa ?? 0,
      transportationViaSepa: metrics.transportationViaSepa ?? 0,
      transportationSepaProviders: distributions.transportationSepaProviders,
      shelterViaSepa: metrics.shelterViaSepa ?? 0,
      shelterSepaProviders: distributions.shelterSepaProviders,
    };
  }

  async getProductivity(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardProductivityResponseDto> {
    const bounds = this.getBounds(query);
    const parameters = [bounds.fromAt, bounds.toAt, bounds.fromDate, bounds.toDate];
    const [populationRows, metricRows] = await Promise.all([
      this.dataSource.query<PopulationRow[]>(
        this.populationQuery(),
        parameters.slice(0, 2),
      ),
      this.dataSource.query<MetricRow[]>(
        this.productivityMetricsQuery(),
        parameters,
      ),
    ]);
    const populationCount = this.toNumber(populationRows[0]?.count ?? 0);
    const metrics = this.toMetrics(metricRows);

    return {
      meta: this.meta(
        bounds,
        populationCount,
        'Indicadores de productividad SEPA: tiempos promedio y beneficios recibidos.',
      ),
      avgDaysEnrollmentToSis: this.toNullableNumber(
        metrics.avgDaysEnrollmentToSis,
      ),
      avgDaysPrimaryCareToDiagnosis: this.toNullableNumber(
        metrics.avgDaysPrimaryCareToDiagnosis,
      ),
      avgDaysDiagnosisToTreatment: this.toNullableNumber(
        metrics.avgDaysDiagnosisToTreatment,
      ),
      activePatients: metrics.activePatients ?? 0,
      benefitSupport: metrics.benefitSupport ?? 0,
      benefitPsychooncology: metrics.benefitPsychooncology ?? 0,
      benefitEducationalTalks: metrics.benefitEducationalTalks ?? 0,
      allThreeBenefits: metrics.allThreeBenefits ?? 0,
    };
  }

  async getAdherence(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardAdherenceResponseDto> {
    const bounds = this.getBounds(query);
    const parameters = [bounds.fromAt, bounds.toAt];
    const [populationRows, metricRows] = await Promise.all([
      this.dataSource.query<PopulationRow[]>(
        this.populationQuery(),
        parameters,
      ),
      this.dataSource.query<MetricRow[]>(
        this.adherenceMetricsQuery(),
        parameters,
      ),
    ]);
    const populationCount = this.toNumber(populationRows[0]?.count ?? 0);
    const metrics = this.toMetrics(metricRows);

    return {
      meta: this.meta(
        bounds,
        populationCount,
        'Indicadores de adherencia al tratamiento y barreras de acceso SEPA.',
      ),
      chemoRadioCompliancePct: metrics.chemoRadioCompliancePct ?? 0,
      hormonalCompleted: metrics.hormonalCompleted ?? 0,
      hormonalPatients: metrics.hormonalPatients ?? 0,
      withAccessBarriers: metrics.withAccessBarriers ?? 0,
      orientedRegardingBarriers: metrics.orientedRegardingBarriers ?? 0,
      abandonedWithBarriers: metrics.abandonedWithBarriers ?? 0,
      interruptedAdverseReaction: metrics.interruptedAdverseReaction ?? 0,
      palliativeNoActiveTreatment: metrics.palliativeNoActiveTreatment ?? 0,
    };
  }

  async getAbandonment(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardAbandonmentResponseDto> {
    const bounds = this.getBounds(query);
    const parameters = [bounds.fromAt, bounds.toAt];
    const [populationRows, metricRows, distributionRows] = await Promise.all([
      this.dataSource.query<PopulationRow[]>(
        this.populationQuery(),
        parameters,
      ),
      this.dataSource.query<MetricRow[]>(
        this.abandonmentMetricsQuery(),
        parameters,
      ),
      this.dataSource.query<DistributionRow[]>(
        this.abandonmentDistributionsQuery(),
        parameters,
      ),
    ]);
    const populationCount = this.toNumber(populationRows[0]?.count ?? 0);
    const metrics = this.toMetrics(metricRows);
    const distributions = this.toDistributions(distributionRows, [
      'dropoutReasons',
    ]);

    return {
      meta: this.meta(
        bounds,
        populationCount,
        'Indicadores de abandono del programa SEPA.',
      ),
      dropoutReasons: distributions.dropoutReasons,
      voluntary: metrics.voluntary ?? 0,
      unlocatable: metrics.unlocatable ?? 0,
      deceased: metrics.deceased ?? 0,
      other: metrics.other ?? 0,
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

  private toDistributions(
    rows: DistributionRow[],
    categoryNames?: string[],
  ) {
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
    for (const category of categoryNames ?? [
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

  private toMetrics(rows: MetricRow[]): Record<string, number> {
    const metrics: Record<string, number> = {};
    for (const row of rows) {
      if (row.value === null || row.value === undefined) continue;
      const parsed = Number(row.value);
      if (!Number.isNaN(parsed)) metrics[row.metric] = parsed;
    }
    return metrics;
  }

  private toNullableNumber(value: number | undefined): number | null {
    if (value === undefined || Number.isNaN(value)) return null;
    return Number(value.toFixed(2));
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

  private managementMetricsQuery(): string {
    return `
      WITH cohort AS (
        SELECT DISTINCT enrollment.patient_id
        FROM enrollments enrollment
        JOIN patients patient ON patient.id = enrollment.patient_id
        WHERE patient.role = 'PATIENT'
          AND enrollment.created_at >= $1
          AND enrollment.created_at < $2
      )
      SELECT metric, value FROM (
        SELECT 'sisAffiliatedViaSepa' AS metric,
          COUNT(DISTINCT insurance.patient_id)::float AS value
        FROM patient_insurance insurance
        JOIN cohort ON cohort.patient_id = insurance.patient_id
        WHERE insurance.is_current = true
          AND insurance.insurance_type = 'SIS'
          AND insurance.affiliated_via_sepa = true
        UNION ALL
        SELECT 'essaludAffiliatedViaSepa',
          COUNT(DISTINCT insurance.patient_id)::float
        FROM patient_insurance insurance
        JOIN cohort ON cohort.patient_id = insurance.patient_id
        WHERE insurance.is_current = true
          AND insurance.insurance_type = 'ESSALUD'
          AND insurance.affiliated_via_sepa = true
        UNION ALL
        SELECT 'primaryCareViaSepa',
          COUNT(DISTINCT appointment.patient_id)::float
        FROM patient_medical_appointments appointment
        JOIN cohort ON cohort.patient_id = appointment.patient_id
        WHERE appointment.is_current = true
          AND appointment.attended_via_sepa = true
        UNION ALL
        SELECT 'referredViaSepa',
          COUNT(DISTINCT appointment.patient_id)::float
        FROM patient_medical_appointments appointment
        JOIN cohort ON cohort.patient_id = appointment.patient_id
        WHERE appointment.is_current = true
          AND appointment.referred_via_sepa = true
        UNION ALL
        SELECT 'diagnosticRuledOutViaSepa',
          COUNT(DISTINCT event.patient_id)::float
        FROM patient_diagnostic_status_events event
        WHERE event.status = 'RULED_OUT'
          AND event.supported_by_sepa = true
          AND event.occurred_at >= $1 AND event.occurred_at < $2
        UNION ALL
        SELECT 'diagnosticConfirmedViaSepa',
          COUNT(DISTINCT event.patient_id)::float
        FROM patient_diagnostic_status_events event
        WHERE event.status = 'CONFIRMED'
          AND event.supported_by_sepa = true
          AND event.occurred_at >= $1 AND event.occurred_at < $2
        UNION ALL
        SELECT 'treatmentViaSepa',
          COUNT(DISTINCT treatment.patient_id)::float
        FROM patient_treatments treatment
        JOIN cohort ON cohort.patient_id = treatment.patient_id
        WHERE treatment.is_current = true
          AND treatment.treatment_via_sepa = true
        UNION ALL
        SELECT 'transportationViaSepa',
          COUNT(DISTINCT details.patient_id)::float
        FROM patient_details details
        JOIN cohort ON cohort.patient_id = details.patient_id
        WHERE details.transportation_via_sepa = true
        UNION ALL
        SELECT 'shelterViaSepa',
          COUNT(DISTINCT details.patient_id)::float
        FROM patient_details details
        JOIN cohort ON cohort.patient_id = details.patient_id
        WHERE details.shelter_via_sepa = true
      ) metrics
    `;
  }

  private managementDistributionsQuery(): string {
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
          diagnosis.patient_id, diagnosis.diagnosis_specialty
        FROM patient_diagnoses diagnosis
        JOIN cohort ON cohort.patient_id = diagnosis.patient_id
        WHERE diagnosis.is_current = true
        ORDER BY diagnosis.patient_id, diagnosis.created_at DESC, diagnosis.id DESC
      ), values AS (
        SELECT 'specialtyForDiagnosis' AS category,
          COALESCE(NULLIF(BTRIM(diagnosis.diagnosis_specialty), ''), '${UNKNOWN_LABEL}') AS label
        FROM cohort
        LEFT JOIN current_diagnoses diagnosis ON diagnosis.patient_id = cohort.patient_id
        UNION ALL
        SELECT 'transportationSepaProviders',
          CASE
            WHEN details.transportation_via_sepa IS DISTINCT FROM true THEN '${NOT_APPLICABLE_LABEL}'
            ELSE COALESCE(NULLIF(BTRIM(details.transportation_sepa_provider), ''), '${UNKNOWN_LABEL}')
          END
        FROM cohort
        LEFT JOIN patient_details details ON details.patient_id = cohort.patient_id
        UNION ALL
        SELECT 'shelterSepaProviders',
          CASE
            WHEN details.shelter_via_sepa IS DISTINCT FROM true THEN '${NOT_APPLICABLE_LABEL}'
            ELSE COALESCE(NULLIF(BTRIM(details.shelter_sepa_provider), ''), '${UNKNOWN_LABEL}')
          END
        FROM cohort
        LEFT JOIN patient_details details ON details.patient_id = cohort.patient_id
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

  private productivityMetricsQuery(): string {
    return `
      WITH cohort AS (
        SELECT DISTINCT enrollment.patient_id,
          MIN(enrollment.created_at) AS enrolled_at
        FROM enrollments enrollment
        JOIN patients patient ON patient.id = enrollment.patient_id
        WHERE patient.role = 'PATIENT'
          AND enrollment.created_at >= $1
          AND enrollment.created_at < $2
        GROUP BY enrollment.patient_id
      ), sis_days AS (
        SELECT AVG(
          EXTRACT(EPOCH FROM (sis.affiliated_at - cohort.enrolled_at)) / 86400.0
        ) AS avg_days
        FROM cohort
        JOIN patient_sis_affiliation sis ON sis.patient_id = cohort.patient_id
        WHERE sis.affiliated_via_sepa = true
          AND sis.affiliated_at IS NOT NULL
      ), primary_care_days AS (
        SELECT AVG(
          (diagnosis.diagnosis_date::date - appointment.appointment_date::date)
        ) AS avg_days
        FROM cohort
        JOIN patient_medical_appointments appointment
          ON appointment.patient_id = cohort.patient_id
         AND appointment.is_current = true
         AND appointment.attended_via_sepa = true
         AND appointment.appointment_date IS NOT NULL
        JOIN patient_diagnoses diagnosis
          ON diagnosis.patient_id = cohort.patient_id
         AND diagnosis.is_current = true
         AND diagnosis.diagnosis_date IS NOT NULL
      ), treatment_days AS (
        SELECT AVG(
          (treatment.start_date::date - diagnosis.diagnosis_date::date)
        ) AS avg_days
        FROM cohort
        JOIN patient_treatments treatment
          ON treatment.patient_id = cohort.patient_id
         AND treatment.is_current = true
         AND treatment.treatment_via_sepa = true
         AND treatment.start_date IS NOT NULL
        JOIN patient_diagnoses diagnosis
          ON diagnosis.id = treatment.diagnosis_id
         AND diagnosis.diagnosis_date IS NOT NULL
      ), benefits AS (
        SELECT
          cohort.patient_id,
          EXISTS (
            SELECT 1 FROM follow_ups follow_up
            WHERE follow_up.subject_patient_id = cohort.patient_id
          ) AS has_support,
          EXISTS (
            SELECT 1 FROM psychooncology_appointments psycho
            WHERE psycho.patient_id = cohort.patient_id
          ) AS has_psycho,
          COALESCE(details.attended_educational_talk, false) AS has_talk
        FROM cohort
        LEFT JOIN patient_details details ON details.patient_id = cohort.patient_id
      )
      SELECT metric, value FROM (
        SELECT 'avgDaysEnrollmentToSis' AS metric, sis_days.avg_days AS value FROM sis_days
        UNION ALL
        SELECT 'avgDaysPrimaryCareToDiagnosis', primary_care_days.avg_days FROM primary_care_days
        UNION ALL
        SELECT 'avgDaysDiagnosisToTreatment', treatment_days.avg_days FROM treatment_days
        UNION ALL
        SELECT 'activePatients',
          COUNT(DISTINCT patient.id)::float
        FROM patients patient
        JOIN cohort ON cohort.patient_id = patient.id
        WHERE patient.activity_status IN ('ACTIVE', 'REACTIVE')
        UNION ALL
        SELECT 'benefitSupport',
          COUNT(*) FILTER (WHERE has_support)::float FROM benefits
        UNION ALL
        SELECT 'benefitPsychooncology',
          COUNT(*) FILTER (WHERE has_psycho)::float FROM benefits
        UNION ALL
        SELECT 'benefitEducationalTalks',
          COUNT(*) FILTER (WHERE has_talk)::float FROM benefits
        UNION ALL
        SELECT 'allThreeBenefits',
          COUNT(*) FILTER (WHERE has_support AND has_psycho AND has_talk)::float
        FROM benefits
      ) metrics
    `;
  }

  private adherenceMetricsQuery(): string {
    return `
      WITH cohort AS (
        SELECT DISTINCT enrollment.patient_id
        FROM enrollments enrollment
        JOIN patients patient ON patient.id = enrollment.patient_id
        WHERE patient.role = 'PATIENT'
          AND enrollment.created_at >= $1
          AND enrollment.created_at < $2
      ), current_treatments AS (
        SELECT treatment.*
        FROM patient_treatments treatment
        JOIN cohort ON cohort.patient_id = treatment.patient_id
        WHERE treatment.is_current = true
      ), session_totals AS (
        SELECT
          COALESCE(SUM(completed_sessions), 0)::float AS completed,
          COALESCE(SUM(scheduled_sessions), 0)::float AS scheduled
        FROM current_treatments
        WHERE completed_sessions IS NOT NULL
          AND scheduled_sessions IS NOT NULL
          AND scheduled_sessions > 0
          AND (
            treatment_type ILIKE '%quimio%'
            OR treatment_type ILIKE '%radio%'
            OR treatment_type ILIKE '%chemo%'
          )
      )
      SELECT metric, value FROM (
        SELECT 'chemoRadioCompliancePct' AS metric,
          CASE
            WHEN session_totals.scheduled = 0 THEN 0
            ELSE ROUND((session_totals.completed / session_totals.scheduled) * 100.0, 2)
          END AS value
        FROM session_totals
        UNION ALL
        SELECT 'hormonalCompleted',
          COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE hormonal_treatment_completed = true
        UNION ALL
        SELECT 'hormonalPatients',
          COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE treatment_type ILIKE '%hormona%'
           OR hormonal_treatment_completed IS NOT NULL
        UNION ALL
        SELECT 'withAccessBarriers',
          COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE access_barrier_code IS NOT NULL
        UNION ALL
        SELECT 'orientedRegardingBarriers',
          COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE oriented_regarding_barriers = true
        UNION ALL
        SELECT 'abandonedWithBarriers',
          COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE treatment_situation = 'ABANDONED'
          AND access_barrier_code IS NOT NULL
        UNION ALL
        SELECT 'interruptedAdverseReaction',
          COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE treatment_situation = 'INTERRUMPIDO'
          AND interruption_reason = 'ADVERSE_REACTION'
        UNION ALL
        SELECT 'palliativeNoActiveTreatment',
          COUNT(DISTINCT details.patient_id)::float
        FROM patient_details details
        JOIN cohort ON cohort.patient_id = details.patient_id
        WHERE details.health_subcategory = 'PALLIATIVE_NO_ACTIVE_TREATMENT'
      ) metrics
    `;
  }

  private abandonmentMetricsQuery(): string {
    return `
      WITH cohort AS (
        SELECT DISTINCT enrollment.patient_id
        FROM enrollments enrollment
        JOIN patients patient ON patient.id = enrollment.patient_id
        WHERE patient.role = 'PATIENT'
          AND enrollment.created_at >= $1
          AND enrollment.created_at < $2
      ), reasons AS (
        SELECT
          COALESCE(
            details.program_dropout_reason_code,
            CASE patient.deactivation_reason
              WHEN 'WITHDREW_CONSENT' THEN 'VOLUNTARY'
              WHEN 'LOST_CONTACT' THEN 'UNLOCATABLE'
              WHEN 'DECEASED' THEN 'DECEASED'
              WHEN 'OTHER' THEN 'OTHER'
              WHEN 'TRANSFERRED_OUT' THEN 'OTHER'
              ELSE NULL
            END
          ) AS reason_code
        FROM cohort
        JOIN patients patient ON patient.id = cohort.patient_id
        LEFT JOIN patient_details details ON details.patient_id = patient.id
        WHERE patient.activity_status = 'INACTIVE'
           OR details.program_dropout_reason_code IS NOT NULL
           OR details.program_dropout_date IS NOT NULL
      )
      SELECT metric, value FROM (
        SELECT 'voluntary' AS metric, COUNT(*) FILTER (WHERE reason_code = 'VOLUNTARY')::float AS value FROM reasons
        UNION ALL
        SELECT 'unlocatable', COUNT(*) FILTER (WHERE reason_code = 'UNLOCATABLE')::float FROM reasons
        UNION ALL
        SELECT 'deceased', COUNT(*) FILTER (WHERE reason_code = 'DECEASED')::float FROM reasons
        UNION ALL
        SELECT 'other', COUNT(*) FILTER (WHERE reason_code = 'OTHER')::float FROM reasons
      ) metrics
    `;
  }

  private abandonmentDistributionsQuery(): string {
    return `
      WITH cohort AS (
        SELECT DISTINCT enrollment.patient_id
        FROM enrollments enrollment
        JOIN patients patient ON patient.id = enrollment.patient_id
        WHERE patient.role = 'PATIENT'
          AND enrollment.created_at >= $1
          AND enrollment.created_at < $2
      ), values AS (
        SELECT 'dropoutReasons' AS category,
          COALESCE(
            NULLIF(BTRIM(details.program_dropout_reason_code), ''),
            CASE patient.deactivation_reason
              WHEN 'WITHDREW_CONSENT' THEN 'VOLUNTARY'
              WHEN 'LOST_CONTACT' THEN 'UNLOCATABLE'
              WHEN 'DECEASED' THEN 'DECEASED'
              WHEN 'OTHER' THEN 'OTHER'
              WHEN 'TRANSFERRED_OUT' THEN 'OTHER'
              ELSE NULL
            END,
            '${UNKNOWN_LABEL}'
          ) AS label
        FROM cohort
        JOIN patients patient ON patient.id = cohort.patient_id
        LEFT JOIN patient_details details ON details.patient_id = patient.id
        WHERE patient.activity_status = 'INACTIVE'
           OR details.program_dropout_reason_code IS NOT NULL
           OR details.program_dropout_date IS NOT NULL
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

}
