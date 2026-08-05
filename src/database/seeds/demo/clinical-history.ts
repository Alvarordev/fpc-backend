import type { Enrollment } from '../../entities/enrollment.entity';
import { PatientDiagnosis } from '../../../patients/entities/patient-diagnosis.entity';
import {
  EpsProvider,
  InsuranceType,
  PatientInsurance,
} from '../../../patients/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../../../patients/entities/patient-medical-appointment.entity';
import { PatientSisAffiliation } from '../../../patients/entities/patient-sis-affiliation.entity';
import { PatientSymptomReport } from '../../../patients/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../../../patients/entities/patient-treatment.entity';
import type { FollowUp } from '../../entities/follow-up.entity';
import {
  CANCER_STAGES,
  DIAGNOSES,
  MEDICAL_SPECIALTIES,
  PAIN_LOCATIONS,
  SIS_BLOCKERS,
  SYMPTOM_DESCRIPTIONS,
  TREATMENT_FREQUENCIES,
  TREATMENT_SITUATIONS,
} from './catalog';
import type { DemoContext } from './context';
import type { PatientFollowUps } from './follow-ups';
import { addDays, toDateOnly } from './rng';

/**
 * Clinical history is versioned: every table keeps one `is_current` row per
 * patient (per diagnosis for treatments, per specialty for appointments) plus
 * any number of superseded rows carrying a `change_reason`. Partial unique
 * indexes enforce that, so this step must never emit two current rows.
 */
export async function seedClinicalHistory(
  ctx: DemoContext,
  histories: PatientFollowUps[],
  enrollmentsByPatient: Map<string, Enrollment>,
): Promise<void> {
  const { manager, rng, now } = ctx;

  const enrolled = histories.filter((history) => history.enrollment !== null);

  const diagnosisRows: PatientDiagnosis[] = [];
  const currentDiagnosisIndex = new Map<string, number>();

  enrolled.forEach((history) => {
    const { patient, healthCenter } = history.demoPatient;
    const seed = rng.pick(DIAGNOSES);
    const diagnosedAt = addDays(now, -rng.int(120, 900));
    const followUpId = anchorFollowUp(ctx, history).id;

    // A minority were re-staged after further imaging; keep the superseded row.
    if (rng.bool(0.25)) {
      diagnosisRows.push(
        manager.create(PatientDiagnosis, {
          patientId: patient.id,
          followUpId,
          diagnosis: seed.diagnosis,
          cancerStage: rng.pick(CANCER_STAGES),
          diagnosisDate: toDateOnly(diagnosedAt),
          healthCenterId: healthCenter.id,
          diagnosisSpecialty: seed.specialty,
          symptomLeadingToCheckup: seed.symptom,
          waitTimeForDiagnosis: rng.pick([
            'Menos de 1 mes',
            'Entre 1 y 3 meses',
            'Más de 6 meses',
          ]),
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
        healthCenterId: healthCenter.id,
        diagnosisSpecialty: seed.specialty,
        symptomLeadingToCheckup: seed.symptom,
        waitTimeForDiagnosis: rng.pick([
          'Menos de 1 mes',
          'Entre 1 y 3 meses',
          'Más de 6 meses',
        ]),
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

  for (const history of enrolled) {
    const { patient, healthCenter } = history.demoPatient;
    const index = currentDiagnosisIndex.get(patient.id);
    if (index === undefined) continue;

    const diagnosis = diagnoses[index];
    const seed = DIAGNOSES.find(
      (item) => item.diagnosis === diagnosis.diagnosis,
    );
    const options = seed?.treatments ?? ['Quimioterapia'];
    const followUpId = anchorFollowUp(ctx, history).id;
    const startedAt = addDays(now, -rng.int(60, 400));

    // A finished earlier line of treatment, superseded by the current one.
    if (options.length > 1 && rng.bool(0.4)) {
      rows.push(
        manager.create(PatientTreatment, {
          patientId: patient.id,
          followUpId,
          diagnosisId: diagnosis.id,
          treatmentType: options[0],
          treatmentFrequency: rng.pick(TREATMENT_FREQUENCIES),
          healthCenterId: healthCenter.id,
          startDate: toDateOnly(startedAt),
          endDate: toDateOnly(addDays(startedAt, rng.int(40, 120))),
          isCurrent: false,
          changeReason:
            'Se completó el esquema y se avanzó a la siguiente fase.',
          notReceivingReason: null,
          treatmentSituation: 'FINALIZADO',
        }),
      );
    }

    const isReceiving = rng.bool(0.85);
    rows.push(
      manager.create(PatientTreatment, {
        patientId: patient.id,
        followUpId,
        diagnosisId: diagnosis.id,
        treatmentType: rng.pick(options),
        treatmentFrequency: isReceiving
          ? rng.pick(TREATMENT_FREQUENCIES)
          : null,
        healthCenterId: healthCenter.id,
        startDate: toDateOnly(addDays(now, -rng.int(15, 120))),
        endDate: null,
        isCurrent: true,
        changeReason: null,
        notReceivingReason: isReceiving
          ? null
          : 'En espera de la aprobación del expediente FISSAL.',
        treatmentSituation: isReceiving
          ? rng.pick(TREATMENT_SITUATIONS.slice(0, 2))
          : 'PENDIENTE_DE_INICIO',
      }),
    );
  }

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
            ? rng.pick(['Menos de 1 semana', '1 a 2 semanas', 'Más de un mes'])
            : null,
          symptomFrequency: hasDiscomfort
            ? rng.pick(['Diaria', 'Intermitente', 'Solo tras el tratamiento'])
            : null,
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
