import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DashboardPeriod } from './dto/dashboard-query.dto';
import {
  DashboardIndicatorQueryDto,
  DashboardPopulation,
} from './dto/dashboard-indicator-query.dto';
import {
  DashboardAbandonmentResponseDto,
  DashboardAdherenceResponseDto,
  DashboardCrossItemDto,
  DashboardDemographicsResponseDto,
  DashboardEpidemiologyResponseDto,
  DashboardIndicatorDistributionDto,
  DashboardIndicatorMetaDto,
  DashboardManagementResponseDto,
  DashboardProductivityResponseDto,
  DashboardSatisfactionResponseDto,
  DashboardSurveySummaryDto,
} from './dto/dashboard-indicator-response.dto';
import { SurveyType } from '../../database/entities/survey.entity';

const TIMEZONE = 'America/Lima';
const UNKNOWN_LABEL = 'Sin informacion';
const NOT_APPLICABLE_LABEL = 'No aplica';
const ACTIVE_STATUSES = `('ACTIVE', 'REACTIVE')`;
const CHEMO_RADIO_TYPES = `('QUIMIOTERAPIA', 'RADIOTERAPIA', 'BRAQUITERAPIA')`;
const HORMONAL_TYPE = `'HORMONOTERAPIA'`;
const limaDate = (expression: string) =>
  `(${expression} AT TIME ZONE '${TIMEZONE}')::date`;

export interface IndicatorBounds {
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

interface CrossRow {
  category: string;
  row: string;
  column: string;
  count: string | number;
}

interface PopulationRow {
  count: string | number;
  enrolledBeforePeriod?: string | number;
}

interface MetricRow {
  metric: string;
  value: string | number | null;
}

interface SurveyRow {
  type: SurveyType;
  rating: number;
  count: string | number;
}

interface PopulationCount {
  populationCount: number;
  enrolledBeforePeriod: number;
}

/**
 * Positional parameters for one SQL statement. Every value coming from the
 * request goes through here; nothing is interpolated into the SQL text.
 */
export class SqlParams {
  readonly values: unknown[] = [];
  private readonly named = new Map<string, string>();

  constructor(private readonly bounds: IndicatorBounds) {}

  add(value: unknown, cast: string, name?: string): string {
    const existing = name ? this.named.get(name) : undefined;
    if (existing) return existing;
    this.values.push(value);
    const placeholder = `$${this.values.length}::${cast}`;
    if (name) this.named.set(name, placeholder);
    return placeholder;
  }

  get from() {
    return this.add(this.bounds.fromAt, 'timestamptz', 'from');
  }
  get to() {
    return this.add(this.bounds.toAt, 'timestamptz', 'to');
  }
  get fromDate() {
    return this.add(this.bounds.fromDate, 'date', 'fromDate');
  }
  get toDate() {
    return this.add(this.bounds.toDate, 'date', 'toDate');
  }
}

export interface CohortOptions {
  /** Keep patients inactive at the period end (abandonment, events, exports). */
  includeInactive?: boolean;
}

const POPULATION_DEFINITIONS: Record<DashboardPopulation, string> = {
  [DashboardPopulation.ALL_ACTIVE]:
    'Pacientes enrolados antes del fin del periodo cuyo ultimo evento de actividad a esa fecha es ACTIVE o REACTIVE (sin eventos = activo).',
  [DashboardPopulation.ACTIVE_IN_PERIOD]:
    'Pacientes activos al cierre del periodo con un enrolamiento, seguimiento completado o sesion de psicooncologia realizada dentro del periodo.',
  [DashboardPopulation.ENROLLED_IN_PERIOD]:
    'Pacientes cuyo primer enrolamiento cae dentro del periodo, sin importar su estado de actividad.',
};

@Injectable()
export class DashboardIndicatorsService {
  constructor(private readonly dataSource: DataSource) {}

  async getDemographics(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardDemographicsResponseDto> {
    const bounds = this.getBounds(query);
    const [population, rows] = await Promise.all([
      this.population(query, bounds),
      this.run<DistributionRow>(bounds, (p) =>
        this.demographicsQuery(p, query),
      ),
    ]);
    const d = this.toDistributions(rows, [
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
      'insuranceTypeAtEnrollment',
    ]);

    return {
      meta: this.meta(
        query,
        bounds,
        population,
        'Distribucion demografica de la poblacion seleccionada (valores vigentes del paciente).',
        {
          age: 'Edad cumplida al ultimo dia del periodo segun patients.birth_date.',
          gender: 'patients.gender.',
          district: 'Distrito de la direccion principal activa.',
          province: 'Provincia de la direccion principal activa.',
          department: 'Departamento de la direccion principal activa.',
          zoneType: 'patient_details.zone_type.',
          educationLevel: 'patient_details.education_level.',
          nativeLanguage: 'patient_details.native_language.',
          requiresTranslation: 'patient_details.requires_translation.',
          isWorking: 'patient_details.is_working.',
          insuranceType:
            'a9 (vigente): tipo de seguro de la version is_current de patient_insurance.',
          epsProvider:
            'Proveedor EPS del seguro vigente; No aplica si no es EPS.',
          insuranceTypeAtEnrollment:
            'a9 (al enrolar): tipo de seguro de la primera version registrada.',
        },
      ),
      age: d.age,
      gender: d.gender,
      district: d.district,
      province: d.province,
      department: d.department,
      zoneType: d.zoneType,
      educationLevel: d.educationLevel,
      nativeLanguage: d.nativeLanguage,
      requiresTranslation: d.requiresTranslation,
      isWorking: d.isWorking,
      insuranceType: d.insuranceType,
      epsProvider: d.epsProvider,
      insuranceTypeAtEnrollment: d.insuranceTypeAtEnrollment,
    };
  }

  async getEpidemiology(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardEpidemiologyResponseDto> {
    const bounds = this.getBounds(query);
    const [population, rows, crossRows, metricRows] = await Promise.all([
      this.population(query, bounds),
      this.run<DistributionRow>(bounds, (p) =>
        this.epidemiologyQuery(p, query),
      ),
      this.run<CrossRow>(bounds, (p) => this.epidemiologyCrossQuery(p, query)),
      this.run<MetricRow>(bounds, (p) => this.eventsQuery(p, query)),
    ]);
    const d = this.toDistributions(rows, [
      'currentDiagnoses',
      'currentCancerStages',
      'currentTreatmentTypes',
      'currentTreatmentSituations',
      'currentDiagnosticStatuses',
    ]);
    const metrics = this.toMetrics(metricRows);
    const cross = (category: string): DashboardCrossItemDto[] =>
      crossRows
        .filter((row) => row.category === category)
        .map((row) => ({
          row: row.row,
          column: row.column,
          count: Number(row.count),
        }));

    return {
      meta: this.meta(
        query,
        bounds,
        population,
        'Estado epidemiologico vigente de la poblacion y eventos ocurridos en el periodo.',
        {
          currentDiagnoses:
            'b2: cada diagnostico vigente (patient_diagnoses.is_current) cuenta una vez; un paciente con varios diagnosticos aporta varios. Pacientes sin diagnostico = Sin informacion.',
          currentCancerStages:
            'b4: estadio de cada diagnostico vigente (cancer_stage).',
          currentTreatmentTypes:
            'b6: cada tratamiento vigente (una version is_current por serie), por codigo de catalogo treatment_type.',
          currentTreatmentSituations:
            'b5, b7-b11: situacion de cada tratamiento vigente (EN_ESPERA, EN_BUSQUEDA, EN_PROCESO, CULMINADO, SUSPENDIDO, REMISION, ABANDONADO, FALLECIDO, NO_APLICA).',
          currentDiagnosticStatuses:
            'Ultimo estado diagnostico registrado antes del fin del periodo, uno por paciente.',
          diagnosisByDepartment:
            'b3: diagnosticos vigentes por departamento de la direccion principal.',
          diagnosisByStage: 'b4: diagnosticos vigentes por estadio.',
          'events.deaths':
            'b1: pacientes de la poblacion (incluye inactivos) fallecidos en el periodo: patients.deceased_at o evento de baja DECEASED (deceased_at o, si falta, fecha del evento).',
          'events.diagnosticConfirmed':
            'Pacientes de la poblacion (incluye inactivos) con un evento CONFIRMED en el periodo.',
          'events.diagnosticRuledOut':
            'Pacientes de la poblacion (incluye inactivos) con un evento RULED_OUT en el periodo.',
        },
      ),
      currentDiagnoses: d.currentDiagnoses,
      currentCancerStages: d.currentCancerStages,
      currentTreatmentTypes: d.currentTreatmentTypes,
      currentTreatmentSituations: d.currentTreatmentSituations,
      currentDiagnosticStatuses: d.currentDiagnosticStatuses,
      diagnosisByDepartment: cross('diagnosisByDepartment'),
      diagnosisByStage: cross('diagnosisByStage'),
      events: {
        deaths: metrics.deaths ?? 0,
        diagnosticConfirmed: metrics.diagnosticConfirmed ?? 0,
        diagnosticRuledOut: metrics.diagnosticRuledOut ?? 0,
      },
    };
  }

  async getManagement(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardManagementResponseDto> {
    const bounds = this.getBounds(query);
    const [population, metricRows, rows] = await Promise.all([
      this.population(query, bounds),
      this.run<MetricRow>(bounds, (p) => this.managementMetricsQuery(p, query)),
      this.run<DistributionRow>(bounds, (p) =>
        this.managementDistributionsQuery(p, query),
      ),
    ]);
    const metrics = this.toMetrics(metricRows);
    const d = this.toDistributions(rows, [
      'specialtyForDiagnosis',
      'transportationSepaProviders',
      'shelterSepaProviders',
    ]);

    return {
      meta: this.meta(
        query,
        bounds,
        population,
        'Indicadores de gestion SEPA (atribucion) sobre la poblacion seleccionada.',
        {
          sisAffiliatedViaSepa:
            'd1: pacientes con patient_sis_affiliation.affiliated_via_sepa = true y affiliated_at antes del fin del periodo (o sin fecha).',
          essaludAffiliatedViaSepa:
            'd2: pacientes con alguna version de patient_insurance ESSALUD affiliated_via_sepa = true con inicio antes del fin del periodo (o sin fecha).',
          primaryCareViaSepa:
            'd3: pacientes con reporte de sintomas attended_primary_care_via_sepa = true o cita vigente attended_via_sepa = true.',
          referredViaSepa:
            'd4: pacientes con referred_via_sepa = true en reporte de sintomas o cita vigente.',
          specialtyForDiagnosis:
            'd5: especialidad de cada diagnostico vigente (diagnosis_specialty).',
          diagnosticRuledOutViaSepa:
            'd6: pacientes con un evento RULED_OUT supported_by_sepa = true en el periodo.',
          diagnosticConfirmedViaSepa:
            'd7: pacientes con un evento CONFIRMED supported_by_sepa = true en el periodo.',
          treatmentViaSepa:
            'd8: pacientes con algun tratamiento treatment_via_sepa = true iniciado antes del fin del periodo (o sin fecha de inicio).',
          transportationViaSepa:
            'd9: patient_details.transportation_via_sepa = true.',
          transportationSepaProviders:
            'd9: proveedor de traslado de quienes lo recibieron por SEPA.',
          shelterViaSepa: 'd10: patient_details.shelter_via_sepa = true.',
          shelterSepaProviders:
            'd10: proveedor de albergue de quienes lo recibieron por SEPA.',
        },
      ),
      sisAffiliatedViaSepa: metrics.sisAffiliatedViaSepa ?? 0,
      essaludAffiliatedViaSepa: metrics.essaludAffiliatedViaSepa ?? 0,
      primaryCareViaSepa: metrics.primaryCareViaSepa ?? 0,
      referredViaSepa: metrics.referredViaSepa ?? 0,
      specialtyForDiagnosis: d.specialtyForDiagnosis,
      diagnosticRuledOutViaSepa: metrics.diagnosticRuledOutViaSepa ?? 0,
      diagnosticConfirmedViaSepa: metrics.diagnosticConfirmedViaSepa ?? 0,
      treatmentViaSepa: metrics.treatmentViaSepa ?? 0,
      transportationViaSepa: metrics.transportationViaSepa ?? 0,
      transportationSepaProviders: d.transportationSepaProviders,
      shelterViaSepa: metrics.shelterViaSepa ?? 0,
      shelterSepaProviders: d.shelterSepaProviders,
    };
  }

  async getProductivity(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardProductivityResponseDto> {
    const bounds = this.getBounds(query);
    const [population, metricRows] = await Promise.all([
      this.population(query, bounds),
      this.run<MetricRow>(bounds, (p) =>
        this.productivityMetricsQuery(p, query),
      ),
    ]);
    const metrics = this.toMetrics(metricRows);

    return {
      meta: this.meta(
        query,
        bounds,
        population,
        'Productividad SEPA: tiempos promedio (un valor por paciente, sin intervalos negativos, sin fechas de registro) y beneficios recibidos.',
        {
          avgDaysEnrollmentToSis:
            'e1: dias entre el primer enrolamiento y la primera afiliacion SIS por SEPA (patient_sis_affiliation.affiliated_via_sepa = true, affiliated_at). Mismo dia = 0; afiliaciones previas al enrolamiento se excluyen.',
          avgDaysPrimaryCareToDiagnosis:
            'e2: pacientes que pasaron por signos y sintomas: dias entre first_primary_care_via_sepa_at y la confirmacion del primer diagnostico (diagnosis_date, o fecha del evento).',
          avgDaysDiagnosisToTreatment:
            'e3: dias entre la confirmacion del primer diagnostico confirmado y el primer start_date de un tratamiento de ese diagnostico.',
          avgDaysSymptomsToDiagnosis:
            'Dias entre first_symptoms_date (diagnostico) y el primer resultado confirmado o descartado.',
          activePatients:
            'e4: pacientes de la poblacion activos al cierre segun patient_activity_events.',
          benefitSupport:
            'e5: pacientes con al menos un seguimiento COMPLETED cuyo proposito no es ENROLLMENT, antes del fin del periodo.',
          benefitPsychooncology:
            'e5: pacientes con al menos una sesion de psicooncologia COMPLETED antes del fin del periodo.',
          benefitEducationalTalks:
            'e5: pacientes con patient_details.attended_educational_talk = true (provisional hasta CH2).',
          allThreeBenefits: 'e6: pacientes con los tres beneficios.',
        },
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
      avgDaysSymptomsToDiagnosis: this.toNullableNumber(
        metrics.avgDaysSymptomsToDiagnosis,
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
    const [population, metricRows, rows] = await Promise.all([
      this.population(query, bounds),
      this.run<MetricRow>(bounds, (p) => this.adherenceMetricsQuery(p, query)),
      this.run<DistributionRow>(bounds, (p) =>
        this.adherenceDistributionsQuery(p, query),
      ),
    ]);
    const metrics = this.toMetrics(metricRows);
    const d = this.toDistributions(rows, ['treatmentAbandonmentReasons']);

    return {
      meta: this.meta(
        query,
        bounds,
        population,
        'Adherencia al tratamiento sobre los tratamientos vigentes de la poblacion.',
        {
          chemoRadioCompliancePct:
            'f1: suma de completed_sessions / suma de scheduled_sessions x 100 en tratamientos vigentes QUIMIOTERAPIA, RADIOTERAPIA o BRAQUITERAPIA con ambos valores conocidos.',
          hormonalCompleted:
            'f2: pacientes con tratamiento vigente HORMONOTERAPIA y hormonal_treatment_completed = true.',
          hormonalPatients:
            'f2: pacientes con tratamiento vigente HORMONOTERAPIA.',
          withAccessBarriers:
            'f3: pacientes con un tratamiento vigente con access_barrier_code.',
          orientedRegardingBarriers:
            'f3: pacientes con un tratamiento vigente oriented_regarding_barriers = true.',
          abandonedWithBarriers:
            'f4: pacientes con un tratamiento vigente ABANDONADO con treatment_abandonment_reason.',
          treatmentAbandonmentReasons:
            'f4: tratamientos vigentes ABANDONADO por treatment_abandonment_reason.',
          interruptedAdverseReaction:
            'f5: pacientes con un tratamiento vigente SUSPENDIDO por ADVERSE_REACTION.',
          palliativeNoActiveTreatment:
            'f5b: pacientes con subcategoria PALLIATIVE_NO_ACTIVE_TREATMENT.',
        },
      ),
      chemoRadioCompliancePct: metrics.chemoRadioCompliancePct ?? 0,
      hormonalCompleted: metrics.hormonalCompleted ?? 0,
      hormonalPatients: metrics.hormonalPatients ?? 0,
      withAccessBarriers: metrics.withAccessBarriers ?? 0,
      orientedRegardingBarriers: metrics.orientedRegardingBarriers ?? 0,
      abandonedWithBarriers: metrics.abandonedWithBarriers ?? 0,
      treatmentAbandonmentReasons: d.treatmentAbandonmentReasons,
      interruptedAdverseReaction: metrics.interruptedAdverseReaction ?? 0,
      palliativeNoActiveTreatment: metrics.palliativeNoActiveTreatment ?? 0,
    };
  }

  async getAbandonment(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardAbandonmentResponseDto> {
    const bounds = this.getBounds(query);
    const options = { includeInactive: true };
    const [population, metricRows, rows] = await Promise.all([
      this.population(query, bounds, options),
      this.run<MetricRow>(bounds, (p) =>
        this.abandonmentMetricsQuery(p, query),
      ),
      this.run<DistributionRow>(bounds, (p) =>
        this.abandonmentDistributionsQuery(p, query),
      ),
    ]);
    const metrics = this.toMetrics(metricRows);
    const d = this.toDistributions(rows, ['dropoutReasons']);

    return {
      meta: this.meta(
        query,
        bounds,
        population,
        'g1: abandono del programa. La poblacion no excluye inactivos; abandono = ultimo evento de actividad antes del fin del periodo es INACTIVE.',
        {
          dropoutReasons:
            'Motivo del ultimo evento INACTIVE al cierre (patient_activity_events.reason).',
          voluntary: 'Motivo VOLUNTARY.',
          unlocatable: 'Motivo UNLOCATABLE.',
          deceased: 'Motivo DECEASED.',
          transferredOut: 'Motivo TRANSFERRED_OUT.',
          other: 'Motivo OTHER (solo datos legados).',
          dropoutsInPeriod:
            'Inactivos al cierre cuyo evento de baja ocurrio dentro del periodo.',
        },
        options,
      ),
      dropoutReasons: d.dropoutReasons,
      voluntary: metrics.voluntary ?? 0,
      unlocatable: metrics.unlocatable ?? 0,
      deceased: metrics.deceased ?? 0,
      transferredOut: metrics.transferredOut ?? 0,
      other: metrics.other ?? 0,
      dropoutsInPeriod: metrics.dropoutsInPeriod ?? 0,
    };
  }

  async getSatisfaction(
    query: DashboardIndicatorQueryDto,
  ): Promise<DashboardSatisfactionResponseDto> {
    const bounds = this.getBounds(query);
    const options = { includeInactive: true };
    const [population, rows] = await Promise.all([
      this.population(query, bounds, options),
      this.run<SurveyRow>(bounds, (p) => this.satisfactionQuery(p, query)),
    ]);
    const summary = (type: SurveyType): DashboardSurveySummaryDto => {
      const byRating = new Map<number, number>();
      for (const row of rows)
        if (row.type === type)
          byRating.set(Number(row.rating), Number(row.count));
      let responses = 0;
      let total = 0;
      for (const [rating, count] of byRating) {
        responses += count;
        total += rating * count;
      }
      return {
        average:
          responses === 0 ? null : Number((total / responses).toFixed(2)),
        responses,
        distribution: [1, 2, 3, 4, 5].map((rating) => ({
          label: String(rating),
          count: byRating.get(rating) ?? 0,
        })),
      };
    };

    return {
      meta: this.meta(
        query,
        bounds,
        population,
        'Satisfaccion: encuestas (1 a 5) respondidas dentro del periodo por pacientes de la poblacion, incluidos inactivos. Promedio y distribucion por calificacion.',
        {
          enrollment: 'c1: encuestas ENROLLMENT (llamada de enrolamiento).',
          threeMonths:
            'c2: encuestas THREE_MONTHS (a los 3 meses del enrolamiento).',
          talk: 'c3: encuestas TALK (charlas y talleres).',
          psychooncology: 'c4: encuestas PSYCHOONCOLOGY (sesiones).',
        },
        options,
      ),
      enrollment: summary(SurveyType.ENROLLMENT),
      threeMonths: summary(SurveyType.THREE_MONTHS),
      talk: summary(SurveyType.TALK),
      psychooncology: summary(SurveyType.PSYCHOONCOLOGY),
    };
  }

  /** Patient ids of the population, so the export matches the dashboard. */
  async cohortPatientIds(
    query: DashboardIndicatorQueryDto,
    bounds: IndicatorBounds,
    options: CohortOptions = {},
  ): Promise<string[]> {
    const rows = await this.run<{ patient_id: string }>(
      bounds,
      (p) =>
        `WITH ${this.cohortCtes(p, query, options)} SELECT patient_id FROM cohort`,
    );
    return rows.map((row) => row.patient_id);
  }

  getBounds(query: DashboardIndicatorQueryDto): IndicatorBounds {
    if (query.from || query.to) {
      if (!query.from || !query.to)
        throw new BadRequestException(
          'Completa las dos fechas del rango.',
        );
      if (query.period || query.year || query.month)
        throw new BadRequestException(
          'Elige un periodo o un rango de fechas, no ambos.',
        );
      if (query.from >= query.to)
        throw new BadRequestException('La fecha «Desde» debe ser anterior a «Hasta».');
      return this.boundsFromDates(query.from, query.to);
    }

    if (!query.period || query.year === undefined)
      throw new BadRequestException(
        'Elige un periodo o un rango de fechas.',
      );
    if (query.period === DashboardPeriod.MONTH && query.month === undefined)
      throw new BadRequestException(
        'Elige el mes.',
      );
    if (query.period === DashboardPeriod.YEAR && query.month !== undefined)
      throw new BadRequestException(
        'El mes solo aplica al periodo mensual.',
      );

    const month = query.period === DashboardPeriod.MONTH ? query.month! : 1;
    const fromDate = this.dateString(query.year, month);
    const toDate =
      query.period === DashboardPeriod.MONTH
        ? this.dateString(query.year, month + 1)
        : this.dateString(query.year + 1, 1);
    return this.boundsFromDates(fromDate, toDate);
  }

  boundsFromDates(fromDate: string, toDate: string): IndicatorBounds {
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

  private run<T>(
    bounds: IndicatorBounds,
    build: (params: SqlParams) => string,
  ): Promise<T[]> {
    const params = new SqlParams(bounds);
    const sql = build(params);
    return this.dataSource.query<T[]>(sql, params.values);
  }

  private async population(
    query: DashboardIndicatorQueryDto,
    bounds: IndicatorBounds,
    options: CohortOptions = {},
  ): Promise<PopulationCount> {
    const rows = await this.run<PopulationRow>(
      bounds,
      (p) => `
        WITH ${this.cohortCtes(p, query, options)}
        SELECT
          COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE enrolled_at < ${p.from})::int AS "enrolledBeforePeriod"
        FROM cohort
      `,
    );
    return {
      populationCount: Number(rows[0]?.count ?? 0),
      enrolledBeforePeriod: Number(rows[0]?.enrolledBeforePeriod ?? 0),
    };
  }

  private meta(
    query: DashboardIndicatorQueryDto,
    bounds: IndicatorBounds,
    population: PopulationCount,
    definition: string,
    definitions: Record<string, string>,
    options: CohortOptions = {},
  ): DashboardIndicatorMetaDto {
    const kind = query.population ?? DashboardPopulation.ALL_ACTIVE;
    const populationCopy =
      options.includeInactive && kind !== DashboardPopulation.ENROLLED_IN_PERIOD
        ? 'Pacientes enrolados antes del fin del periodo, activos o inactivos a esa fecha.'
        : POPULATION_DEFINITIONS[kind];
    return {
      from: bounds.fromDate,
      to: bounds.toDate,
      timezone: TIMEZONE,
      definition,
      definitions,
      population: populationCopy,
      populationCount: population.populationCount,
      enrolledBeforePeriod: population.enrolledBeforePeriod,
    };
  }

  private toDistributions(rows: DistributionRow[], categoryNames: string[]) {
    const categories = new Map<string, DashboardIndicatorDistributionDto>();
    for (const row of rows) {
      let distribution = categories.get(row.category);
      if (!distribution) {
        const known = Number(row.known ?? 0);
        const unknown = Number(row.unknown ?? 0);
        distribution = {
          items: [],
          known,
          unknown,
          population: known + unknown,
          coveragePct: this.coverage(known, unknown),
        };
        categories.set(row.category, distribution);
      }
      distribution.items.push({ label: row.label, count: Number(row.count) });
    }
    const distributions: Record<string, DashboardIndicatorDistributionDto> = {};
    for (const category of categoryNames)
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

  /** Shared filters (D3) over `patient` and `details`. */
  private filterPredicate(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    const parts: string[] = [];
    const department = query.department
      ?.trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
    if (department)
      parts.push(`EXISTS (
        SELECT 1 FROM patient_addresses address
        WHERE address.patient_id = patient.id
          AND address.is_primary = true
          AND address.is_active = true
          AND REPLACE(UPPER(BTRIM(address.department)), ' ', '_') = ${p.add(department, 'text')}
      )`);
    if (query.healthCenterId)
      parts.push(
        `details.primary_health_center_id = ${p.add(query.healthCenterId, 'uuid')}`,
      );
    if (query.agentId)
      parts.push(`EXISTS (
        SELECT 1 FROM follow_ups agent_follow_up
        WHERE agent_follow_up.subject_patient_id = patient.id
          AND agent_follow_up.agent_id = ${p.add(query.agentId, 'uuid')}
      )`);
    if (query.healthPhase)
      parts.push(`details.health_phase = ${p.add(query.healthPhase, 'text')}`);
    if (query.healthSubcategory)
      parts.push(
        `details.health_subcategory = ${p.add(query.healthSubcategory, 'text')}`,
      );
    return parts.map((part) => `AND ${part}`).join('\n');
  }

  /**
   * CTEs ending in `cohort (patient_id, enrolled_at, status_at_close,
   * reason_at_close, status_changed_at)`. The status at the period end is the
   * last patient_activity_events row before it; no event yet means active.
   */
  cohortCtes(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
    options: CohortOptions = {},
  ): string {
    const population = query.population ?? DashboardPopulation.ALL_ACTIVE;
    const conditions: string[] = [`first_enrollment.enrolled_at < ${p.to}`];
    if (population === DashboardPopulation.ENROLLED_IN_PERIOD)
      conditions.push(`first_enrollment.enrolled_at >= ${p.from}`);
    else if (!options.includeInactive)
      conditions.push(
        `COALESCE(activity.status, 'ACTIVE') IN ${ACTIVE_STATUSES}`,
      );
    if (population === DashboardPopulation.ACTIVE_IN_PERIOD)
      conditions.push(`(
        first_enrollment.enrolled_at >= ${p.from}
        OR EXISTS (
          SELECT 1 FROM follow_ups follow_up
          WHERE follow_up.subject_patient_id = patient.id
            AND follow_up.status = 'COMPLETED'
            AND follow_up.completed_at >= ${p.from}
            AND follow_up.completed_at < ${p.to}
        )
        OR EXISTS (
          SELECT 1 FROM psychooncology_appointments psycho
          WHERE psycho.patient_id = patient.id
            AND psycho.status = 'COMPLETED'
            AND COALESCE(psycho.completed_at, psycho.scheduled_at) >= ${p.from}
            AND COALESCE(psycho.completed_at, psycho.scheduled_at) < ${p.to}
        )
      )`);

    return `
      first_enrollment AS (
        SELECT enrollment.patient_id,
          MIN(COALESCE(enrollment.enrolled_on::timestamp AT TIME ZONE '${TIMEZONE}', enrollment.created_at)) AS enrolled_at
        FROM enrollments enrollment
        GROUP BY enrollment.patient_id
      ),
      activity_at_close AS (
        SELECT DISTINCT ON (event.patient_id)
          event.patient_id, event.status, event.reason, event.occurred_at
        FROM patient_activity_events event
        WHERE event.occurred_at < ${p.to}
        ORDER BY event.patient_id, event.occurred_at DESC, event.created_at DESC, event.id DESC
      ),
      cohort AS (
        SELECT
          patient.id AS patient_id,
          first_enrollment.enrolled_at,
          COALESCE(activity.status, 'ACTIVE') AS status_at_close,
          activity.reason AS reason_at_close,
          activity.occurred_at AS status_changed_at
        FROM patients patient
        JOIN first_enrollment ON first_enrollment.patient_id = patient.id
        LEFT JOIN patient_details details ON details.patient_id = patient.id
        LEFT JOIN activity_at_close activity ON activity.patient_id = patient.id
        WHERE patient.role = 'PATIENT'
          AND ${conditions.join('\n          AND ')}
          ${this.filterPredicate(p, query)}
      )
    `;
  }

  private distributionTail(excludeNotApplicable = true): string {
    const excluded = excludeNotApplicable
      ? `('${UNKNOWN_LABEL}', '${NOT_APPLICABLE_LABEL}')`
      : `('${UNKNOWN_LABEL}')`;
    return `
      counts AS (
        SELECT category, label, COUNT(*) AS count
        FROM values
        GROUP BY category, label
      )
      SELECT category, label, count,
        COALESCE(SUM(count) FILTER (WHERE label NOT IN ${excluded}) OVER (PARTITION BY category), 0) AS known,
        COALESCE(SUM(count) FILTER (WHERE label = '${UNKNOWN_LABEL}') OVER (PARTITION BY category), 0) AS unknown
      FROM counts
      ORDER BY category, count DESC, label ASC
    `;
  }

  private demographicsQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    return `
      WITH ${this.cohortCtes(p, query)}, primary_addresses AS (
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
      ), entry_insurance AS (
        SELECT DISTINCT ON (insurance.patient_id)
          insurance.patient_id, insurance.insurance_type
        FROM patient_insurance insurance
        JOIN cohort ON cohort.patient_id = insurance.patient_id
        ORDER BY insurance.patient_id, insurance.created_at ASC, insurance.id ASC
      ), patient_values AS (
        SELECT
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
          entry.insurance_type AS entry_insurance_type,
          EXTRACT(YEAR FROM age((${p.toDate} - 1)::timestamp, patient.birth_date::timestamp))::integer AS age_years
        FROM cohort
        JOIN patients patient ON patient.id = cohort.patient_id
        LEFT JOIN patient_details details ON details.patient_id = patient.id
        LEFT JOIN primary_addresses address ON address.patient_id = patient.id
        LEFT JOIN current_insurance insurance ON insurance.patient_id = patient.id
        LEFT JOIN entry_insurance entry ON entry.patient_id = patient.id
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
        UNION ALL SELECT 'insuranceTypeAtEnrollment',
          COALESCE(NULLIF(BTRIM(entry_insurance_type), ''), '${UNKNOWN_LABEL}')
        FROM patient_values
      ), ${this.distributionTail()}
    `;
  }

  /** Every current diagnosis and treatment of the cohort (F10). */
  private currentClinicalCtes(): string {
    return `
      current_diagnoses AS (
        SELECT diagnosis.patient_id, diagnosis.id, diagnosis.diagnosis,
          diagnosis.cancer_stage, diagnosis.diagnosis_specialty
        FROM patient_diagnoses diagnosis
        JOIN cohort ON cohort.patient_id = diagnosis.patient_id
        WHERE diagnosis.is_current = true
      ), current_treatments AS (
        SELECT treatment.*
        FROM patient_treatments treatment
        JOIN cohort ON cohort.patient_id = treatment.patient_id
        WHERE treatment.is_current = true
      )
    `;
  }

  private epidemiologyQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    return `
      WITH ${this.cohortCtes(p, query)}, ${this.currentClinicalCtes()},
      current_statuses AS (
        SELECT DISTINCT ON (status.patient_id)
          status.patient_id, status.status
        FROM patient_diagnostic_status_events status
        JOIN cohort ON cohort.patient_id = status.patient_id
        WHERE status.occurred_at < ${p.to}
        ORDER BY status.patient_id, status.occurred_at DESC, status.created_at DESC, status.id DESC
      ), diagnosis_rows AS (
        SELECT diagnosis.diagnosis, diagnosis.cancer_stage
        FROM cohort LEFT JOIN current_diagnoses diagnosis ON diagnosis.patient_id = cohort.patient_id
      ), treatment_rows AS (
        SELECT treatment.treatment_type, treatment.treatment_situation
        FROM cohort LEFT JOIN current_treatments treatment ON treatment.patient_id = cohort.patient_id
      ), values AS (
        SELECT 'currentDiagnoses' AS category, COALESCE(NULLIF(BTRIM(diagnosis), ''), '${UNKNOWN_LABEL}') AS label FROM diagnosis_rows
        UNION ALL SELECT 'currentCancerStages', COALESCE(NULLIF(BTRIM(cancer_stage), ''), '${UNKNOWN_LABEL}') FROM diagnosis_rows
        UNION ALL SELECT 'currentTreatmentTypes', COALESCE(NULLIF(BTRIM(treatment_type), ''), '${UNKNOWN_LABEL}') FROM treatment_rows
        UNION ALL SELECT 'currentTreatmentSituations', COALESCE(NULLIF(BTRIM(treatment_situation), ''), '${UNKNOWN_LABEL}') FROM treatment_rows
        UNION ALL SELECT 'currentDiagnosticStatuses', COALESCE(NULLIF(BTRIM(status.status), ''), '${UNKNOWN_LABEL}')
        FROM cohort LEFT JOIN current_statuses status ON status.patient_id = cohort.patient_id
      ), ${this.distributionTail(false)}
    `;
  }

  private epidemiologyCrossQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    return `
      WITH ${this.cohortCtes(p, query)}, ${this.currentClinicalCtes()},
      primary_addresses AS (
        SELECT DISTINCT ON (address.patient_id) address.patient_id, address.department
        FROM patient_addresses address
        JOIN cohort ON cohort.patient_id = address.patient_id
        WHERE address.is_primary = true AND address.is_active = true
        ORDER BY address.patient_id, address.created_at DESC, address.id DESC
      ), cross_rows AS (
        SELECT 'diagnosisByDepartment' AS category,
          COALESCE(NULLIF(BTRIM(diagnosis.diagnosis), ''), '${UNKNOWN_LABEL}') AS "row",
          COALESCE(NULLIF(BTRIM(address.department), ''), '${UNKNOWN_LABEL}') AS "column"
        FROM current_diagnoses diagnosis
        LEFT JOIN primary_addresses address ON address.patient_id = diagnosis.patient_id
        UNION ALL
        SELECT 'diagnosisByStage',
          COALESCE(NULLIF(BTRIM(diagnosis.diagnosis), ''), '${UNKNOWN_LABEL}'),
          COALESCE(NULLIF(BTRIM(diagnosis.cancer_stage), ''), '${UNKNOWN_LABEL}')
        FROM current_diagnoses diagnosis
      )
      SELECT category, "row", "column", COUNT(*)::int AS count
      FROM cross_rows
      GROUP BY category, "row", "column"
      ORDER BY category, count DESC, "row", "column"
    `;
  }

  private eventsQuery(p: SqlParams, query: DashboardIndicatorQueryDto): string {
    const deathDate = `COALESCE(event.deceased_at, ${limaDate('event.occurred_at')})`;
    return `
      WITH ${this.cohortCtes(p, query, { includeInactive: true })}
      SELECT metric, value FROM (
        SELECT 'deaths' AS metric, COUNT(*)::float AS value
        FROM cohort
        JOIN patients patient ON patient.id = cohort.patient_id
        WHERE (patient.deceased_at >= ${p.fromDate} AND patient.deceased_at < ${p.toDate})
          OR EXISTS (
            SELECT 1 FROM patient_activity_events event
            WHERE event.patient_id = cohort.patient_id
              AND event.reason = 'DECEASED'
              AND ${deathDate} >= ${p.fromDate}
              AND ${deathDate} < ${p.toDate}
          )
        UNION ALL
        SELECT 'diagnosticConfirmed', COUNT(DISTINCT event.patient_id)::float
        FROM patient_diagnostic_status_events event
        JOIN cohort ON cohort.patient_id = event.patient_id
        WHERE event.status = 'CONFIRMED'
          AND event.occurred_at >= ${p.from} AND event.occurred_at < ${p.to}
        UNION ALL
        SELECT 'diagnosticRuledOut', COUNT(DISTINCT event.patient_id)::float
        FROM patient_diagnostic_status_events event
        JOIN cohort ON cohort.patient_id = event.patient_id
        WHERE event.status = 'RULED_OUT'
          AND event.occurred_at >= ${p.from} AND event.occurred_at < ${p.to}
      ) metrics
    `;
  }

  private managementMetricsQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    const sepaStatusEvent = (status: string) => `
      SELECT COUNT(DISTINCT event.patient_id)::float
      FROM patient_diagnostic_status_events event
      JOIN cohort ON cohort.patient_id = event.patient_id
      WHERE event.status = '${status}'
        AND event.supported_by_sepa = true
        AND event.occurred_at >= ${p.from} AND event.occurred_at < ${p.to}
    `;
    return `
      WITH ${this.cohortCtes(p, query)}
      SELECT metric, value FROM (
        SELECT 'sisAffiliatedViaSepa' AS metric,
          COUNT(DISTINCT sis.patient_id)::float AS value
        FROM patient_sis_affiliation sis
        JOIN cohort ON cohort.patient_id = sis.patient_id
        WHERE sis.affiliated_via_sepa = true
          AND (sis.affiliated_at IS NULL OR sis.affiliated_at < ${p.to})
        UNION ALL
        SELECT 'essaludAffiliatedViaSepa',
          COUNT(DISTINCT insurance.patient_id)::float
        FROM patient_insurance insurance
        JOIN cohort ON cohort.patient_id = insurance.patient_id
        WHERE insurance.insurance_type = 'ESSALUD'
          AND insurance.affiliated_via_sepa = true
          AND (insurance.start_date IS NULL OR insurance.start_date < ${p.toDate})
        UNION ALL
        SELECT 'primaryCareViaSepa',
          COUNT(DISTINCT primary_care.patient_id)::float
        FROM (
          SELECT appointment.patient_id
          FROM patient_medical_appointments appointment
          JOIN cohort ON cohort.patient_id = appointment.patient_id
          WHERE appointment.is_current = true
            AND appointment.attended_via_sepa = true
          UNION
          SELECT symptom.patient_id
          FROM patient_symptom_reports symptom
          JOIN cohort ON cohort.patient_id = symptom.patient_id
          WHERE symptom.attended_primary_care_via_sepa = true
        ) primary_care
        UNION ALL
        SELECT 'referredViaSepa',
          COUNT(DISTINCT referred.patient_id)::float
        FROM (
          SELECT appointment.patient_id
          FROM patient_medical_appointments appointment
          JOIN cohort ON cohort.patient_id = appointment.patient_id
          WHERE appointment.is_current = true
            AND appointment.referred_via_sepa = true
          UNION
          SELECT symptom.patient_id
          FROM patient_symptom_reports symptom
          JOIN cohort ON cohort.patient_id = symptom.patient_id
          WHERE symptom.referred_via_sepa = true
        ) referred
        UNION ALL
        SELECT 'diagnosticRuledOutViaSepa', (${sepaStatusEvent('RULED_OUT')})
        UNION ALL
        SELECT 'diagnosticConfirmedViaSepa', (${sepaStatusEvent('CONFIRMED')})
        UNION ALL
        SELECT 'treatmentViaSepa',
          COUNT(DISTINCT treatment.patient_id)::float
        FROM patient_treatments treatment
        JOIN cohort ON cohort.patient_id = treatment.patient_id
        WHERE treatment.treatment_via_sepa = true
          AND (treatment.start_date IS NULL OR treatment.start_date < ${p.toDate})
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

  private managementDistributionsQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    return `
      WITH ${this.cohortCtes(p, query)}, ${this.currentClinicalCtes()},
      values AS (
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
      ), ${this.distributionTail()}
    `;
  }

  private productivityMetricsQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    const milestone = (type: string) => `(
      SELECT patient_id, occurred_on FROM patient_clinical_milestones
      WHERE milestone_type = '${type}' AND occurred_on < ${p.toDate}
    )`;
    return `
      WITH ${this.cohortCtes(p, query)}, sis_days AS (
        SELECT ${limaDate('MIN(sis.affiliated_at)')} - ${limaDate('cohort.enrolled_at')} AS days
        FROM cohort
        JOIN patient_sis_affiliation sis ON sis.patient_id = cohort.patient_id
        WHERE sis.affiliated_via_sepa = true
          AND sis.affiliated_at IS NOT NULL
          AND sis.affiliated_at < ${p.to}
        GROUP BY cohort.patient_id, cohort.enrolled_at
      ), primary_care_days AS (
        SELECT confirmed.occurred_on - first_care.occurred_on AS days
        FROM cohort
        JOIN ${milestone('FIRST_PRIMARY_CARE')} first_care ON first_care.patient_id = cohort.patient_id
        JOIN ${milestone('DIAGNOSIS_CONFIRMED')} confirmed ON confirmed.patient_id = cohort.patient_id
        WHERE EXISTS (
          SELECT 1 FROM patient_health_phase_history phase
          WHERE phase.patient_id = cohort.patient_id
            AND phase.health_phase = 'SIGNS_AND_SYMPTOMS'
        ) OR EXISTS (
          SELECT 1 FROM patient_details details
          WHERE details.patient_id = cohort.patient_id
            AND details.health_phase = 'SIGNS_AND_SYMPTOMS'
        )
      ), treatment_days AS (
        SELECT started.occurred_on - confirmed.occurred_on AS days
        FROM cohort
        JOIN ${milestone('DIAGNOSIS_CONFIRMED')} confirmed ON confirmed.patient_id = cohort.patient_id
        JOIN ${milestone('TREATMENT_STARTED')} started ON started.patient_id = cohort.patient_id
      ), symptoms_days AS (
        SELECT MIN(outcome.occurred_on) - onset.occurred_on AS days
        FROM cohort
        JOIN ${milestone('SYMPTOMS_ONSET')} onset ON onset.patient_id = cohort.patient_id
        JOIN patient_clinical_milestones outcome
          ON outcome.patient_id = cohort.patient_id
         AND outcome.milestone_type IN ('DIAGNOSIS_CONFIRMED', 'DIAGNOSIS_RULED_OUT')
         AND outcome.occurred_on < ${p.toDate}
        GROUP BY cohort.patient_id, onset.occurred_on
      ), benefits AS (
        SELECT
          EXISTS (
            SELECT 1 FROM follow_ups follow_up
            WHERE follow_up.subject_patient_id = cohort.patient_id
              AND follow_up.status = 'COMPLETED'
              AND follow_up.purpose <> 'ENROLLMENT'
              AND COALESCE(follow_up.completed_at, follow_up.scheduled_at) < ${p.to}
          ) AS has_support,
          EXISTS (
            SELECT 1 FROM psychooncology_appointments psycho
            WHERE psycho.patient_id = cohort.patient_id
              AND psycho.status = 'COMPLETED'
              AND COALESCE(psycho.completed_at, psycho.scheduled_at) < ${p.to}
          ) AS has_psycho,
          COALESCE(details.attended_educational_talk, false) AS has_talk
        FROM cohort
        LEFT JOIN patient_details details ON details.patient_id = cohort.patient_id
      )
      SELECT metric, value FROM (
        SELECT 'avgDaysEnrollmentToSis' AS metric, AVG(days)::float AS value FROM sis_days WHERE days >= 0
        UNION ALL
        SELECT 'avgDaysPrimaryCareToDiagnosis', AVG(days)::float FROM primary_care_days WHERE days >= 0
        UNION ALL
        SELECT 'avgDaysDiagnosisToTreatment', AVG(days)::float FROM treatment_days WHERE days >= 0
        UNION ALL
        SELECT 'avgDaysSymptomsToDiagnosis', AVG(days)::float FROM symptoms_days WHERE days >= 0
        UNION ALL
        SELECT 'activePatients', COUNT(*)::float FROM cohort
        WHERE status_at_close IN ${ACTIVE_STATUSES}
        UNION ALL
        SELECT 'benefitSupport', COUNT(*) FILTER (WHERE has_support)::float FROM benefits
        UNION ALL
        SELECT 'benefitPsychooncology', COUNT(*) FILTER (WHERE has_psycho)::float FROM benefits
        UNION ALL
        SELECT 'benefitEducationalTalks', COUNT(*) FILTER (WHERE has_talk)::float FROM benefits
        UNION ALL
        SELECT 'allThreeBenefits',
          COUNT(*) FILTER (WHERE has_support AND has_psycho AND has_talk)::float
        FROM benefits
      ) metrics
    `;
  }

  private adherenceMetricsQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    return `
      WITH ${this.cohortCtes(p, query)}, ${this.currentClinicalCtes()},
      session_totals AS (
        SELECT
          COALESCE(SUM(completed_sessions), 0)::float AS completed,
          COALESCE(SUM(scheduled_sessions), 0)::float AS scheduled
        FROM current_treatments
        WHERE completed_sessions IS NOT NULL
          AND scheduled_sessions IS NOT NULL
          AND scheduled_sessions > 0
          AND treatment_type IN ${CHEMO_RADIO_TYPES}
      )
      SELECT metric, value FROM (
        SELECT 'chemoRadioCompliancePct' AS metric,
          CASE
            WHEN session_totals.scheduled = 0 THEN 0
            ELSE ROUND(((session_totals.completed / session_totals.scheduled) * 100.0)::numeric, 2)::float
          END AS value
        FROM session_totals
        UNION ALL
        SELECT 'hormonalCompleted', COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE treatment_type = ${HORMONAL_TYPE} AND hormonal_treatment_completed = true
        UNION ALL
        SELECT 'hormonalPatients', COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE treatment_type = ${HORMONAL_TYPE}
        UNION ALL
        SELECT 'withAccessBarriers', COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE access_barrier_code IS NOT NULL
        UNION ALL
        SELECT 'orientedRegardingBarriers', COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE oriented_regarding_barriers = true
        UNION ALL
        SELECT 'abandonedWithBarriers', COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE treatment_situation = 'ABANDONADO'
          AND NULLIF(BTRIM(treatment_abandonment_reason), '') IS NOT NULL
        UNION ALL
        SELECT 'interruptedAdverseReaction', COUNT(DISTINCT patient_id)::float
        FROM current_treatments
        WHERE treatment_situation = 'SUSPENDIDO'
          AND interruption_reason = 'ADVERSE_REACTION'
        UNION ALL
        SELECT 'palliativeNoActiveTreatment', COUNT(DISTINCT details.patient_id)::float
        FROM patient_details details
        JOIN cohort ON cohort.patient_id = details.patient_id
        WHERE details.health_subcategory = 'PALLIATIVE_NO_ACTIVE_TREATMENT'
      ) metrics
    `;
  }

  private adherenceDistributionsQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    return `
      WITH ${this.cohortCtes(p, query)}, ${this.currentClinicalCtes()},
      values AS (
        SELECT 'treatmentAbandonmentReasons' AS category,
          COALESCE(NULLIF(BTRIM(treatment_abandonment_reason), ''), '${UNKNOWN_LABEL}') AS label
        FROM current_treatments
        WHERE treatment_situation = 'ABANDONADO'
      ), ${this.distributionTail(false)}
    `;
  }

  private abandonmentMetricsQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    const count = (reason: string) =>
      `COUNT(*) FILTER (WHERE reason_at_close = '${reason}')::float`;
    return `
      WITH ${this.cohortCtes(p, query, { includeInactive: true })},
      dropouts AS (SELECT * FROM cohort WHERE status_at_close = 'INACTIVE')
      SELECT metric, value FROM (
        SELECT 'voluntary' AS metric, ${count('VOLUNTARY')} AS value FROM dropouts
        UNION ALL SELECT 'unlocatable', ${count('UNLOCATABLE')} FROM dropouts
        UNION ALL SELECT 'deceased', ${count('DECEASED')} FROM dropouts
        UNION ALL SELECT 'transferredOut', ${count('TRANSFERRED_OUT')} FROM dropouts
        UNION ALL SELECT 'other', ${count('OTHER')} FROM dropouts
        UNION ALL SELECT 'dropoutsInPeriod',
          COUNT(*) FILTER (WHERE status_changed_at >= ${p.from})::float FROM dropouts
      ) metrics
    `;
  }

  private abandonmentDistributionsQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    return `
      WITH ${this.cohortCtes(p, query, { includeInactive: true })},
      values AS (
        SELECT 'dropoutReasons' AS category,
          COALESCE(NULLIF(BTRIM(reason_at_close), ''), '${UNKNOWN_LABEL}') AS label
        FROM cohort
        WHERE status_at_close = 'INACTIVE'
      ), ${this.distributionTail(false)}
    `;
  }

  private satisfactionQuery(
    p: SqlParams,
    query: DashboardIndicatorQueryDto,
  ): string {
    return `
      WITH ${this.cohortCtes(p, query, { includeInactive: true })}
      SELECT survey.type, survey.rating, COUNT(*)::int AS count
      FROM surveys survey
      JOIN cohort ON cohort.patient_id = survey.patient_id
      WHERE survey.answered_at >= ${p.from} AND survey.answered_at < ${p.to}
      GROUP BY survey.type, survey.rating
    `;
  }
}
