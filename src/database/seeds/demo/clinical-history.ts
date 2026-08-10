import type { Enrollment } from '../../entities/enrollment.entity';
import { PatientDiagnosis } from '../../entities/patient-diagnosis.entity';
import { WaitTimeSource } from '../../entities/wait-time-source.enum';
import { DurationUnit } from '../../entities/duration-unit.enum';
import {
  EpsProvider,
  InsuranceType,
  PatientInsurance,
} from '../../entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../../entities/patient-medical-appointment.entity';
import { PatientSisAffiliation } from '../../entities/patient-sis-affiliation.entity';
import { PatientSymptomReport } from '../../entities/patient-symptom-report.entity';
import { PatientTreatment } from '../../entities/patient-treatment.entity';
import { TreatmentSituation } from '../../entities/treatment-situation.enum';
import { TreatmentMedication } from '../../entities/treatment-medication.entity';
import { DoseUnit } from '../../entities/dose-unit.enum';
import { MedicationRoute } from '../../entities/medication-route.enum';
import { PatientReferral } from '../../entities/patient-referral.entity';
import type { HealthCenter } from '../../entities/health-center.entity';
import type { FollowUp } from '../../entities/follow-up.entity';
import {
  CANCER_STAGES,
  DIAGNOSES,
  MEDICAL_SPECIALTIES,
  PAIN_LOCATIONS,
  SIS_BLOCKERS,
  SYMPTOM_DESCRIPTIONS,
} from './catalog';
import type { DemoContext } from './context';
import type { PatientFollowUps } from './follow-ups';
import { addDays, toDateOnly } from './rng';
import { normalizeDuration } from '../../../shared/duration/duration.util';

const WAIT_TIME_LABELS = [
  { valueMin: 20, unit: DurationUnit.DAY, label: 'Menos de 1 mes' },
  {
    valueMin: 1,
    valueMax: 3,
    unit: DurationUnit.MONTH,
    label: 'Entre 1 y 3 meses',
  },
  { valueMin: 6, unit: DurationUnit.MONTH, label: 'Más de 6 meses' },
] as const;

const TREATMENT_FREQUENCY_DURATIONS = [
  { valueMin: 21, unit: DurationUnit.DAY, label: 'Cada 21 días' },
  { valueMin: 1, unit: DurationUnit.WEEK, label: 'Semanal' },
  { valueMin: 14, unit: DurationUnit.DAY, label: 'Cada 14 días' },
  { valueMin: 5, unit: DurationUnit.WEEK, label: 'Diario por 5 semanas' },
  { valueMin: 1, unit: DurationUnit.MONTH, label: 'Mensual' },
] as const;

const SYMPTOM_DURATIONS = [
  { valueMin: 5, unit: DurationUnit.DAY, label: 'Menos de 1 semana' },
  { valueMin: 1, valueMax: 2, unit: DurationUnit.WEEK, label: '1 a 2 semanas' },
  { valueMin: 1, unit: DurationUnit.MONTH, label: 'Más de un mes' },
] as const;

const SYMPTOM_FREQUENCIES = [
  { valueMin: 1, unit: DurationUnit.DAY, label: 'Diaria' },
  { valueMin: 2, unit: DurationUnit.DAY, label: 'Intermitente' },
  { valueMin: 1, unit: DurationUnit.WEEK, label: 'Solo tras el tratamiento' },
] as const;

interface MedicationSeed {
  name: string;
  doseAmount: number;
  doseUnit: DoseUnit;
  route: MedicationRoute;
}

/**
 * Matched by substring against the treatment type, since the catalog uses
 * varied phrasing ("Quimioterapia neoadyuvante", "Quimiorradioterapia", …).
 */
const MEDICATIONS_BY_TREATMENT_KEYWORD: ReadonlyArray<
  [keyword: string, medications: MedicationSeed[]]
> = [
  [
    'quimio',
    [
      {
        name: 'Doxorrubicina',
        doseAmount: 60,
        doseUnit: DoseUnit.MG,
        route: MedicationRoute.IV,
      },
      {
        name: 'Ciclofosfamida',
        doseAmount: 600,
        doseUnit: DoseUnit.MG,
        route: MedicationRoute.IV,
      },
    ],
  ],
  [
    'radioterapia',
    [
      {
        name: 'Dexametasona',
        doseAmount: 4,
        doseUnit: DoseUnit.MG,
        route: MedicationRoute.ORAL,
      },
    ],
  ],
  [
    'hormonoterapia',
    [
      {
        name: 'Tamoxifeno',
        doseAmount: 20,
        doseUnit: DoseUnit.MG,
        route: MedicationRoute.ORAL,
      },
    ],
  ],
];

function medicationsFor(treatmentType: string): MedicationSeed[] {
  const normalized = treatmentType.toLowerCase();
  const match = MEDICATIONS_BY_TREATMENT_KEYWORD.find(([keyword]) =>
    normalized.includes(keyword),
  );
  return match?.[1] ?? [];
}

/**
 * Clinical history is versioned: every table keeps one `is_current` row per
 * patient (per treatment series for treatments, per specialty for
 * appointments) plus any number of superseded rows carrying a
 * `change_reason`. Partial unique indexes enforce that, so this step must
 * never emit two current rows for the same key.
 */
export async function seedClinicalHistory(
  ctx: DemoContext,
  histories: PatientFollowUps[],
  enrollmentsByPatient: Map<string, Enrollment>,
  healthCenters: HealthCenter[],
): Promise<void> {
  const { manager, rng, now } = ctx;

  const enrolled = histories.filter((history) => history.enrollment !== null);

  const diagnosisRows: PatientDiagnosis[] = [];
  const currentDiagnosisIndex = new Map<string, number>();

  enrolled.forEach((history, index) => {
    const { patient, healthCenter } = history.demoPatient;
    const seed = rng.pick(DIAGNOSES);
    const followUpId = anchorFollowUp(ctx, history).id;

    // A minority saw a doctor long before being formally diagnosed — for
    // these we compute the wait instead of relying on a self-reported range.
    const usesComputedWait = index % 3 === 0;
    const diagnosedAt = addDays(now, -rng.int(120, 900));
    const firstSymptomsAt = usesComputedWait
      ? addDays(diagnosedAt, -rng.int(10, 200))
      : null;

    const buildWaitTime = () => {
      if (firstSymptomsAt) {
        const days = Math.round(
          (diagnosedAt.getTime() - firstSymptomsAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return {
          waitTimeForDiagnosis: normalizeDuration({
            valueMin: days,
            unit: DurationUnit.DAY,
          }),
          waitTimeSource: WaitTimeSource.COMPUTED,
        };
      }
      return {
        waitTimeForDiagnosis: normalizeDuration(rng.pick(WAIT_TIME_LABELS)),
        waitTimeSource: WaitTimeSource.REPORTED,
      };
    };

    // A minority were re-staged after further imaging; keep the superseded row.
    if (rng.bool(0.25)) {
      diagnosisRows.push(
        manager.create(PatientDiagnosis, {
          patientId: patient.id,
          followUpId,
          diagnosis: seed.diagnosis,
          cancerStage: rng.pick(CANCER_STAGES),
          diagnosisDate: toDateOnly(diagnosedAt),
          // Restaging does not change when the patient first felt symptoms, so
          // the superseded row carries the same date. Leaving it null here
          // would pair a COMPUTED wait with no date to compute it from — a
          // state PatientDiagnosesService.create() can never produce.
          firstSymptomsDate: firstSymptomsAt
            ? toDateOnly(firstSymptomsAt)
            : null,
          healthCenterId: healthCenter.id,
          diagnosisSpecialty: seed.specialty,
          symptomLeadingToCheckup: seed.symptom,
          ...buildWaitTime(),
          hasMedicalReport: rng.bool(0.6),
          isCurrent: false,
          changeReason: 'Reestadificación tras nuevos estudios de imagen.',
        }),
      );
    }

    currentDiagnosisIndex.set(patient.id, diagnosisRows.length);
    diagnosisRows.push(
      manager.create(PatientDiagnosis, {
        patientId: patient.id,
        followUpId,
        diagnosis: seed.diagnosis,
        cancerStage: rng.pick(CANCER_STAGES),
        diagnosisDate: toDateOnly(diagnosedAt),
        firstSymptomsDate: firstSymptomsAt ? toDateOnly(firstSymptomsAt) : null,
        healthCenterId: healthCenter.id,
        diagnosisSpecialty: seed.specialty,
        symptomLeadingToCheckup: seed.symptom,
        ...buildWaitTime(),
        hasMedicalReport: rng.bool(0.7),
        isCurrent: true,
        changeReason: null,
      }),
    );
  });

  const diagnoses = await manager.save(diagnosisRows);

  await seedInsurance(ctx, enrolled);
  await seedTreatments(ctx, enrolled, diagnoses, currentDiagnosisIndex);
  await seedMedicalAppointments(ctx, enrolled);
  await seedSymptomReports(ctx, enrolled, enrollmentsByPatient);
  await seedReferrals(ctx, enrolled, healthCenters);
}

/** Clinical rows must hang off a real follow-up; prefer a completed one. */
function anchorFollowUp(
  { rng }: DemoContext,
  history: PatientFollowUps,
): FollowUp {
  return history.completed.length > 0
    ? rng.pick(history.completed)
    : history.firstContact;
}

function pickInsuranceType({ rng }: DemoContext, index: number): InsuranceType {
  if (index === 1 || index === 2) return InsuranceType.NONE;
  if (index === 3) return InsuranceType.EPS;
  return rng.bool(0.75) ? InsuranceType.SIS : InsuranceType.ESSALUD;
}

async function seedInsurance(
  ctx: DemoContext,
  enrolled: PatientFollowUps[],
): Promise<void> {
  const { manager, rng, now } = ctx;
  const rows: PatientInsurance[] = [];

  enrolled.forEach((history, index) => {
    const patientId = history.demoPatient.patient.id;
    const followUpId = anchorFollowUp(ctx, history).id;

    // One documented transition from uninsured to SIS — the program's core win.
    if (index === 0) {
      rows.push(
        manager.create(PatientInsurance, {
          patientId,
          followUpId,
          insuranceType: InsuranceType.NONE,
          epsProvider: null,
          isCurrent: false,
          changeReason: 'Afiliación al SIS gestionada con apoyo del programa.',
          startDate: toDateOnly(addDays(now, -400)),
          endDate: toDateOnly(addDays(now, -150)),
        }),
      );
      rows.push(
        manager.create(PatientInsurance, {
          patientId,
          followUpId,
          insuranceType: InsuranceType.SIS,
          epsProvider: null,
          isCurrent: true,
          changeReason: null,
          startDate: toDateOnly(addDays(now, -150)),
          endDate: null,
        }),
      );
      return;
    }

    // Fixed slots so the dataset always exercises the paths the UI branches on:
    // two uninsured patients (which produce SIS affiliation attempts) and one
    // EPS patient (the only insurance type carrying a provider).
    const insuranceType = pickInsuranceType(ctx, index);

    rows.push(
      manager.create(PatientInsurance, {
        patientId,
        followUpId,
        insuranceType,
        epsProvider:
          insuranceType === InsuranceType.EPS
            ? rng.pick(Object.values(EpsProvider))
            : null,
        isCurrent: true,
        changeReason: null,
        startDate: toDateOnly(addDays(now, -rng.int(200, 1200))),
        endDate: null,
      }),
    );
  });

  const saved = await manager.save(rows);

  // Uninsured patients get an SIS affiliation attempt on file.
  const uninsured = saved.filter(
    (row) => row.isCurrent && row.insuranceType === InsuranceType.NONE,
  );
  const affiliationRows = uninsured.map((row) => {
    const canAffiliate = rng.bool(0.6);
    return manager.create(PatientSisAffiliation, {
      patientId: row.patientId,
      followUpId: row.followUpId,
      canAffiliate,
      expectedDate: canAffiliate
        ? toDateOnly(addDays(now, rng.int(5, 45)))
        : null,
      cantAffiliateReason: canAffiliate ? null : rng.pick(SIS_BLOCKERS),
      affiliatedAt: null,
      comments: canAffiliate
        ? 'Se le explicó la documentación necesaria para el trámite.'
        : 'Se coordinará con trabajo social para resolver el impedimento.',
    });
  });

  await manager.save(affiliationRows);
}

async function seedTreatments(
  ctx: DemoContext,
  enrolled: PatientFollowUps[],
  diagnoses: PatientDiagnosis[],
  currentDiagnosisIndex: Map<string, number>,
): Promise<void> {
  const { manager, rng, now } = ctx;
  const rows: PatientTreatment[] = [];
  const currentTreatmentsByPatient = new Map<
    string,
    Array<{ treatment: PatientTreatment; diagnosisId: string }>
  >();

  enrolled.forEach((history, patientIndex) => {
    const { patient, healthCenter } = history.demoPatient;
    const index = currentDiagnosisIndex.get(patient.id);
    if (index === undefined) return;

    const diagnosis = diagnoses[index];
    const seed = DIAGNOSES.find(
      (item) => item.diagnosis === diagnosis.diagnosis,
    );
    const options = seed?.treatments ?? ['Quimioterapia'];
    const followUpId = anchorFollowUp(ctx, history).id;
    const startedAt = addDays(now, -rng.int(60, 400));

    const patientCurrentTreatments: Array<{
      treatment: PatientTreatment;
      diagnosisId: string;
    }> = [];

    // A finished earlier line of treatment, superseded by the current one —
    // same series, reused seriesId, only the newest row is current.
    const firstSeriesId = crypto.randomUUID();
    if (options.length > 1 && rng.bool(0.4)) {
      rows.push(
        manager.create(PatientTreatment, {
          patientId: patient.id,
          followUpId,
          diagnosisId: diagnosis.id,
          seriesId: firstSeriesId,
          treatmentType: options[0],
          treatmentFrequency: normalizeDuration(
            rng.pick(TREATMENT_FREQUENCY_DURATIONS),
          ),
          healthCenterId: healthCenter.id,
          startDate: toDateOnly(startedAt),
          endDate: toDateOnly(addDays(startedAt, rng.int(40, 120))),
          isCurrent: false,
          changeReason:
            'Se completó el esquema y se avanzó a la siguiente fase.',
          notReceivingReason: null,
          treatmentSituation: TreatmentSituation.FINALIZADO,
          hasLatestPrescription: null,
          latestPrescriptionDate: null,
        }),
      );
    }

    const isReceiving = rng.bool(0.85);
    const currentTreatmentType = rng.pick(options);
    const currentTreatment = manager.create(PatientTreatment, {
      patientId: patient.id,
      followUpId,
      diagnosisId: diagnosis.id,
      seriesId: firstSeriesId,
      treatmentType: currentTreatmentType,
      treatmentFrequency: isReceiving
        ? normalizeDuration(rng.pick(TREATMENT_FREQUENCY_DURATIONS))
        : normalizeDuration(null),
      healthCenterId: healthCenter.id,
      startDate: toDateOnly(addDays(now, -rng.int(15, 120))),
      endDate: null,
      isCurrent: true,
      changeReason: null,
      notReceivingReason: isReceiving
        ? null
        : 'En espera de la aprobación del expediente FISSAL.',
      treatmentSituation: isReceiving
        ? rng.pick([
            TreatmentSituation.EN_CURSO,
            TreatmentSituation.INTERRUMPIDO,
          ])
        : TreatmentSituation.PENDIENTE_DE_INICIO,
      hasLatestPrescription: isReceiving ? rng.maybeBool(0.7) : null,
      latestPrescriptionDate:
        isReceiving && rng.bool(0.6)
          ? toDateOnly(addDays(now, -rng.int(5, 40)))
          : null,
    });
    rows.push(currentTreatment);
    patientCurrentTreatments.push({
      treatment: currentTreatment,
      diagnosisId: diagnosis.id,
    });

    // A subset of patients run two concurrent treatment lines at once —
    // e.g. chemo plus radiotherapy — each with its own seriesId.
    if (isReceiving && options.length > 1 && patientIndex % 5 === 0) {
      const otherOptions = options.filter(
        (option) => option !== currentTreatmentType,
      );
      if (otherOptions.length > 0) {
        const concurrentTreatment = manager.create(PatientTreatment, {
          patientId: patient.id,
          followUpId,
          diagnosisId: diagnosis.id,
          seriesId: crypto.randomUUID(),
          treatmentType: rng.pick(otherOptions),
          treatmentFrequency: normalizeDuration(
            rng.pick(TREATMENT_FREQUENCY_DURATIONS),
          ),
          healthCenterId: healthCenter.id,
          startDate: toDateOnly(addDays(now, -rng.int(10, 90))),
          endDate: null,
          isCurrent: true,
          changeReason: null,
          notReceivingReason: null,
          treatmentSituation: TreatmentSituation.EN_CURSO,
          hasLatestPrescription: rng.maybeBool(0.7),
          latestPrescriptionDate: rng.bool(0.6)
            ? toDateOnly(addDays(now, -rng.int(5, 40)))
            : null,
        });
        rows.push(concurrentTreatment);
        patientCurrentTreatments.push({
          treatment: concurrentTreatment,
          diagnosisId: diagnosis.id,
        });
      }
    }

    currentTreatmentsByPatient.set(patient.id, patientCurrentTreatments);
  });

  const saved = await manager.save(rows);
  await seedMedications(ctx, saved);
}

async function seedMedications(
  { manager, rng }: DemoContext,
  treatments: PatientTreatment[],
): Promise<void> {
  const rows: TreatmentMedication[] = [];

  treatments
    .filter((treatment) => treatment.isCurrent)
    .forEach((treatment) => {
      const catalog = medicationsFor(treatment.treatmentType);
      if (!catalog.length) return;

      catalog.forEach((medication) => {
        rows.push(
          manager.create(TreatmentMedication, {
            treatmentId: treatment.id,
            patientId: treatment.patientId,
            name: medication.name,
            doseAmount: String(medication.doseAmount),
            doseUnit: medication.doseUnit,
            route: medication.route,
            frequency: normalizeDuration(
              rng.pick(TREATMENT_FREQUENCY_DURATIONS),
            ),
            startDate: treatment.startDate,
            endDate: treatment.endDate,
            isActive: true,
            notes: null,
          }),
        );
      });
    });

  await manager.save(rows);
}

async function seedMedicalAppointments(
  ctx: DemoContext,
  enrolled: PatientFollowUps[],
): Promise<void> {
  const { manager, rng, now } = ctx;
  const rows: PatientMedicalAppointment[] = [];

  for (const history of enrolled) {
    const { patient, healthCenter } = history.demoPatient;
    const followUpId = anchorFollowUp(ctx, history).id;
    // Distinct specialties: the current-row index is unique per (patient, specialty).
    const specialties = rng.pickN(MEDICAL_SPECIALTIES, rng.int(1, 3));

    specialties.forEach((specialty, index) => {
      const appointmentDate = addDays(now, -rng.int(5, 90));
      rows.push(
        manager.create(PatientMedicalAppointment, {
          patientId: patient.id,
          followUpId,
          healthCenterId: healthCenter.id,
          specialty,
          appointmentDate: toDateOnly(appointmentDate),
          nextAppointmentDate: rng.bool(0.7)
            ? toDateOnly(addDays(now, rng.int(3, 60)))
            : null,
          hasReferralSheet: rng.bool(0.5),
          referredTo: rng.bool(0.3) ? rng.pick(MEDICAL_SPECIALTIES) : null,
          difficulties: rng.bool(0.35)
            ? rng.pick([
                'No consiguió cita en el horario disponible.',
                'El costo del pasaje dificulta asistir cada mes.',
                'La cita fue reprogramada dos veces por el hospital.',
              ])
            : null,
          isFirstConsultation: index === 0,
          isCurrent: true,
          changeReason: null,
        }),
      );
    });
  }

  await manager.save(rows);
}

async function seedSymptomReports(
  ctx: DemoContext,
  enrolled: PatientFollowUps[],
  enrollmentsByPatient: Map<string, Enrollment>,
): Promise<void> {
  const { manager, rng } = ctx;
  const rows: PatientSymptomReport[] = [];

  for (const history of enrolled) {
    const { patient, healthCenter } = history.demoPatient;
    const enrollment = enrollmentsByPatient.get(patient.id) ?? null;

    for (let index = 0; index < rng.int(1, 2); index += 1) {
      const hasDiscomfort = rng.bool(0.7);
      const isPainPresent = hasDiscomfort && rng.bool(0.65);
      const soughtConsultation = hasDiscomfort && rng.bool(0.5);

      rows.push(
        manager.create(PatientSymptomReport, {
          patientId: patient.id,
          followUpId: anchorFollowUp(ctx, history).id,
          enrollmentId: enrollment?.id ?? null,
          hasDiscomfort,
          discomfortSeverity: hasDiscomfort
            ? rng.pick(['LEVE', 'MODERADO', 'SEVERO'])
            : null,
          discomfortDescription: hasDiscomfort
            ? rng.pick(SYMPTOM_DESCRIPTIONS)
            : null,
          signsAndSymptoms: hasDiscomfort
            ? rng.pick(SYMPTOM_DESCRIPTIONS)
            : 'Sin síntomas relevantes al momento de la llamada.',
          indicationsReceived: hasDiscomfort
            ? 'Se reforzaron las indicaciones del oncólogo tratante.'
            : null,
          symptomDuration: hasDiscomfort
            ? normalizeDuration(rng.pick(SYMPTOM_DURATIONS))
            : normalizeDuration(null),
          symptomFrequency: hasDiscomfort
            ? normalizeDuration(rng.pick(SYMPTOM_FREQUENCIES))
            : normalizeDuration(null),
          isPainPresent,
          painIntensity: isPainPresent ? rng.int(2, 9) : null,
          painLocation: isPainPresent ? rng.pick(PAIN_LOCATIONS) : null,
          painDescription: isPainPresent
            ? rng.pick([
                'Dolor punzante que cede parcialmente con analgésicos.',
                'Dolor sordo continuo que empeora por las noches.',
              ])
            : null,
          hasSoughtMedicalConsultation: soughtConsultation,
          healthCenterId: soughtConsultation ? healthCenter.id : null,
          specialty: soughtConsultation ? 'Medicina del dolor' : null,
        }),
      );
    }
  }

  await manager.save(rows);
}

/**
 * A subset of patients enrolled at one hospital end up treated at another —
 * derived to a referral hub while keeping their original hospital as the
 * enrollment's primary one.
 */
async function seedReferrals(
  ctx: DemoContext,
  enrolled: PatientFollowUps[],
  healthCenters: HealthCenter[],
): Promise<void> {
  const { manager, rng, now } = ctx;
  const rows: PatientReferral[] = [];

  enrolled.forEach((history, index) => {
    if (index % 4 !== 0) return;

    const { patient, healthCenter } = history.demoPatient;
    const alternatives = healthCenters.filter(
      (center) => center.isActive && center.id !== healthCenter.id,
    );
    if (alternatives.length === 0) return;

    const destination = rng.pick(alternatives);
    const followUpId = anchorFollowUp(ctx, history).id;

    rows.push(
      manager.create(PatientReferral, {
        patientId: patient.id,
        followUpId,
        fromHealthCenterId: healthCenter.id,
        toHealthCenterId: destination.id,
        specialty: rng.pick(MEDICAL_SPECIALTIES),
        reason:
          'Se derivó para continuar el tratamiento en un centro con mayor disponibilidad.',
        referralDate: toDateOnly(addDays(now, -rng.int(10, 200))),
        isActive: true,
        hasReferralSheet: rng.bool(0.6),
      }),
    );
  });

  await manager.save(rows);
}
