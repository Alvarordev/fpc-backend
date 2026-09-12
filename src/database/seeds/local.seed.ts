import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import type { EntityManager } from 'typeorm';
import dataSource from '../data-source';
import { Agent } from '../entities/agent.entity';
import { AffiliationType, Enrollment } from '../entities/enrollment.entity';
import { DurationUnit } from '../entities/duration-unit.enum';
import { EducationLevel } from '../entities/education-level.enum';
import { FollowUp } from '../entities/follow-up.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../entities/follow-up.enums';
import { HealthCenter } from '../entities/health-center.entity';
import { MedicalConsultationStatus } from '../entities/medical-consultation-status.enum';
import { PatientActivityStatus } from '../entities/patient-activity-status.enum';
import { PatientDetails } from '../entities/patient-details.entity';
import { PatientDiagnosticStatus } from '../entities/patient-diagnostic-status.enum';
import { PatientDiagnosticStatusEvent } from '../entities/patient-diagnostic-status-event.entity';
import { PatientHealthPhase } from '../entities/patient-health-phase.enum';
import { PatientHealthSubcategory } from '../entities/patient-health-subcategory.enum';
import { PatientNonOncologicalFollowUp } from '../entities/patient-non-oncological-follow-up.entity';
import { PatientNonOncologicalFollowUpStatus } from '../entities/patient-non-oncological-follow-up-status.enum';
import { Patient } from '../entities/patient.entity';
import { PatientRole } from '../entities/patient-role.enum';
import { PatientStatus } from '../entities/patient-status.enum';
import { PatientSymptomReport } from '../entities/patient-symptom-report.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../entities/user-role.enum';
import { normalizeDuration } from '../../shared/duration/duration.util';
import { ensureAdminUser, BCRYPT_ROUNDS } from './admin-user';
import { resetDomainTables } from './demo/reset';
import {
  seedCatalogItems,
  seedStagingHealthCenters,
  seedUbigeo,
} from './staging/seed-reference-data';

const PATIENT_COUNT = 10;
const DEFAULT_AGENT_EMAIL = 'agente.local@fpc.local';
const DEFAULT_AGENT_PASSWORD = 'Agent1234!';

interface LocalPatientSeed {
  fullName: string;
  gender: 'F' | 'M';
  healthCenterIndex: number;
  hasDiscomfort: boolean;
  hasMedicalConsultation: boolean;
  isOncologicalPatient: boolean;
  diagnosisStatus: PatientDiagnosticStatus;
  diagnosis: string;
}

const PATIENT_SEEDS: readonly LocalPatientSeed[] = [
  {
    fullName: 'Ana Torres Mendoza',
    gender: 'F',
    healthCenterIndex: 0,
    hasDiscomfort: true,
    hasMedicalConsultation: true,
    isOncologicalPatient: true,
    diagnosisStatus: PatientDiagnosticStatus.CONFIRMED,
    diagnosis: 'Cancer de mama',
  },
  {
    fullName: 'Bruno Castillo Rojas',
    gender: 'M',
    healthCenterIndex: 1,
    hasDiscomfort: false,
    hasMedicalConsultation: false,
    isOncologicalPatient: false,
    diagnosisStatus: PatientDiagnosticStatus.SEARCHING,
    diagnosis: 'Hipertension arterial',
  },
  {
    fullName: 'Carla Fernandez Paredes',
    gender: 'F',
    healthCenterIndex: 2,
    hasDiscomfort: true,
    hasMedicalConsultation: true,
    isOncologicalPatient: true,
    diagnosisStatus: PatientDiagnosticStatus.RULED_OUT,
    diagnosis: 'Lesion benigna en estudio',
  },
  {
    fullName: 'Diego Salazar Quispe',
    gender: 'M',
    healthCenterIndex: 3,
    hasDiscomfort: false,
    hasMedicalConsultation: false,
    isOncologicalPatient: false,
    diagnosisStatus: PatientDiagnosticStatus.SEARCHING,
    diagnosis: 'Diabetes mellitus tipo 2',
  },
  {
    fullName: 'Elena Vargas Huaman',
    gender: 'F',
    healthCenterIndex: 4,
    hasDiscomfort: true,
    hasMedicalConsultation: true,
    isOncologicalPatient: true,
    diagnosisStatus: PatientDiagnosticStatus.CONFIRMED,
    diagnosis: 'Cancer de cuello uterino',
  },
  {
    fullName: 'Felipe Ramos Cardenas',
    gender: 'M',
    healthCenterIndex: 5,
    hasDiscomfort: false,
    hasMedicalConsultation: false,
    isOncologicalPatient: false,
    diagnosisStatus: PatientDiagnosticStatus.SEARCHING,
    diagnosis: 'Asma persistente',
  },
  {
    fullName: 'Gabriela Leon Soto',
    gender: 'F',
    healthCenterIndex: 6,
    hasDiscomfort: true,
    hasMedicalConsultation: true,
    isOncologicalPatient: true,
    diagnosisStatus: PatientDiagnosticStatus.RULED_OUT,
    diagnosis: 'Masa mamaria descartada',
  },
  {
    fullName: 'Hugo Medina Flores',
    gender: 'M',
    healthCenterIndex: 7,
    hasDiscomfort: false,
    hasMedicalConsultation: false,
    isOncologicalPatient: false,
    diagnosisStatus: PatientDiagnosticStatus.SEARCHING,
    diagnosis: 'Enfermedad renal cronica',
  },
  {
    fullName: 'Irene Ponce Aguilar',
    gender: 'F',
    healthCenterIndex: 8,
    hasDiscomfort: true,
    hasMedicalConsultation: true,
    isOncologicalPatient: true,
    diagnosisStatus: PatientDiagnosticStatus.CONFIRMED,
    diagnosis: 'Cancer colorrectal',
  },
  {
    fullName: 'Jorge Valdez Nina',
    gender: 'M',
    healthCenterIndex: 9,
    hasDiscomfort: false,
    hasMedicalConsultation: false,
    isOncologicalPatient: false,
    diagnosisStatus: PatientDiagnosticStatus.SEARCHING,
    diagnosis: 'Artritis reumatoide',
  },
];

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function atTime(date: Date, hour: number): Date {
  const result = new Date(date);
  result.setUTCHours(hour, 0, 0, 0);
  return result;
}

async function seedAgent(manager: EntityManager): Promise<Agent> {
  const email =
    process.env.SEED_LOCAL_AGENT_EMAIL?.trim().toLowerCase() ??
    DEFAULT_AGENT_EMAIL;
  const password =
    process.env.SEED_LOCAL_AGENT_PASSWORD ?? DEFAULT_AGENT_PASSWORD;
  const user = await manager.save(
    manager.create(User, {
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: UserRole.AGENT,
    }),
  );

  return manager.save(
    manager.create(Agent, {
      userId: user.id,
      fullName: 'Agente tecnico local',
      phone: '+51 987 000 000',
    }),
  );
}

async function seedPatients(
  manager: EntityManager,
  healthCenters: HealthCenter[],
  now: Date,
): Promise<Patient[]> {
  const patients = await manager.save(
    PATIENT_SEEDS.map((seed, index) =>
      manager.create(Patient, {
        fullName: seed.fullName,
        email: `paciente.${index + 1}@fpc.local`,
        dni: `9000000${index + 1}`,
        birthDate: toDateOnly(addDays(now, -(28 + index * 4) * 365)),
        gender: seed.gender,
        primaryPhone: `+51 987 100 ${String(index + 1).padStart(3, '0')}`,
        secondaryPhone: null,
        hasWhatsapp: index % 3 !== 0,
        role: PatientRole.PATIENT,
        status: PatientStatus.ENROLLED,
        activityStatus: PatientActivityStatus.ACTIVE,
        deactivationReason: null,
        deactivationReasonDetail: null,
        deactivatedAt: null,
        deceasedAt: null,
      }),
    ),
  );

  await manager.save(
    patients.map((patient, index) => {
      const seed = PATIENT_SEEDS[index];
      const healthCenter = healthCenters[seed.healthCenterIndex];
      return manager.create(PatientDetails, {
        patientId: patient.id,
        healthPhase: PatientHealthPhase.SIGNS_AND_SYMPTOMS,
        healthSubcategory: PatientHealthSubcategory.SIGNS_AND_SYMPTOMS_PATIENT,
        birthDepartment: healthCenter.department,
        primaryHealthCenterId: healthCenter.id,
        travelTimeToHospital: normalizeDuration({
          valueMin: index % 2 === 0 ? 45 : 90,
          unit: DurationUnit.MINUTE,
        }),
        emergencyContactName: `Contacto ${index + 1}`,
        emergencyContactPhone: `+51 986 200 ${String(index + 1).padStart(3, '0')}`,
        zoneType: index % 3 === 0 ? 'RURAL' : 'URBANA',
        emergencyContactGender: index % 2 === 0 ? 'F' : 'M',
        educationLevel: EducationLevel.SECONDARY,
        nativeLanguage: 'Castellano',
        requiresTranslation: false,
        referredToSocialWorker: index % 4 === 0,
        evidenceOfDomesticViolence: false,
        usesWoodStove: index % 3 === 0,
        isWorking: index % 2 === 0,
        receivesFinancialSupport: index % 3 === 0,
        hasConadisCard: false,
        knowsAboutFissal: seed.isOncologicalPatient,
        programDropoutReason: null,
        programDropoutDate: null,
      });
    }),
  );

  return patients;
}

async function seedFollowUps(
  manager: EntityManager,
  patients: Patient[],
  agent: Agent,
  now: Date,
): Promise<FollowUp[]> {
  return manager.save(
    patients.map((patient, index) => {
      const scheduledAt = atTime(addDays(now, -(index + 1)), 10 + (index % 5));
      return manager.create(FollowUp, {
        subjectPatientId: patient.id,
        interlocutorId: patient.id,
        agentId: agent.id,
        type: index % 2 === 0 ? FollowUpType.CALL : FollowUpType.WHATSAPP,
        status: FollowUpStatus.COMPLETED,
        purpose: FollowUpPurpose.ENROLLMENT,
        scheduledAt,
        scheduledOn: toDateOnly(scheduledAt),
        completedAt: addDays(scheduledAt, 0),
        completedOn: toDateOnly(scheduledAt),
        notes: 'Seguimiento inicial cargado por el seed local.',
        nextFollowUpId: null,
        isHistorical: false,
        historicalLoadedById: null,
      });
    }),
  );
}

async function seedEnrollments(
  manager: EntityManager,
  patients: Patient[],
  followUps: FollowUp[],
  now: Date,
): Promise<Enrollment[]> {
  return manager.save(
    patients.map((patient, index) => {
      const seed = PATIENT_SEEDS[index];
      return manager.create(Enrollment, {
        patientId: patient.id,
        followUpId: followUps[index].id,
        enrolledOn: toDateOnly(addDays(now, -(index + 1))),
        affiliationType: AffiliationType.SELF,
        companionId: null,
        currentlyAttendingConsultations: seed.hasMedicalConsultation,
        currentlyReceivingTreatment: seed.isOncologicalPatient,
        notAttendingConsultationsNote: seed.hasMedicalConsultation
          ? null
          : 'Aun no logra obtener una cita de especialidad.',
        notReceivingTreatmentReason: seed.isOncologicalPatient
          ? null
          : 'No corresponde tratamiento oncologico.',
        entrySource: 'SEPA',
        entrySubSource: 'SEED_LOCAL',
        consentToContact: true,
        consentToShareData: true,
        requiresTransportation: index % 3 === 0,
        hasMobilityIssues: index === 3,
        isOncologicalPatient: seed.isOncologicalPatient,
        surveyAccepted: true,
        caseComments: 'Registro de prueba del contrato clinico nuevo.',
        isHistorical: false,
        historicalLoadedById: null,
        callStartedAt: followUps[index].scheduledAt,
        callEndedAt: followUps[index].completedAt,
        followUpQualityRating: 5,
      });
    }),
  );
}

async function seedSymptomReports(
  manager: EntityManager,
  patients: Patient[],
  followUps: FollowUp[],
  enrollments: Enrollment[],
  healthCenters: HealthCenter[],
  now: Date,
): Promise<PatientSymptomReport[]> {
  return manager.save(
    patients.map((patient, index) => {
      const seed = PATIENT_SEEDS[index];
      const healthCenter = healthCenters[seed.healthCenterIndex];
      const referredHealthCenter =
        healthCenters[(index + 1) % healthCenters.length];
      const firstConsultationDate = toDateOnly(addDays(now, -(index + 2)));

      return manager.create(PatientSymptomReport, {
        patientId: patient.id,
        followUpId: followUps[index].id,
        enrollmentId: enrollments[index].id,
        discomfortSeverity: seed.hasDiscomfort ? 'MODERADO' : null,
        discomfortDescription: seed.hasDiscomfort
          ? 'Molestia intermitente reportada durante la llamada.'
          : null,
        hasDiscomfort: seed.hasDiscomfort,
        checkupMotivation: seed.hasDiscomfort
          ? 'Consulta por signos y sintomas recientes.'
          : 'Desea orientacion preventiva.',
        signsAndSymptoms: seed.hasDiscomfort
          ? 'Dolor localizado y cansancio ocasional.'
          : 'No menciona signos o sintomas relevantes.',
        indicationsReceived: seed.hasMedicalConsultation
          ? 'Continuar indicaciones del equipo tratante.'
          : null,
        symptomDuration: seed.hasDiscomfort
          ? normalizeDuration({ valueMin: 2, unit: DurationUnit.WEEK })
          : normalizeDuration(null),
        symptomFrequency: seed.hasDiscomfort
          ? normalizeDuration({ valueMin: 3, unit: DurationUnit.DAY })
          : normalizeDuration(null),
        isPainPresent: seed.hasDiscomfort,
        painIntensity: seed.hasDiscomfort ? 5 : null,
        painLocation: seed.hasDiscomfort ? 'Region abdominal' : null,
        painDescription: seed.hasDiscomfort
          ? 'Dolor que aumenta al final del dia.'
          : null,
        hasSoughtMedicalConsultation: seed.hasMedicalConsultation,
        hasRequestedMedicalConsultation: seed.hasMedicalConsultation,
        hasMedicalConsultation: seed.hasMedicalConsultation,
        noMedicalConsultationReason: seed.hasMedicalConsultation
          ? null
          : 'No encontro una cita disponible.',
        firstConsultationDate: seed.hasMedicalConsultation
          ? firstConsultationDate
          : null,
        isAwaitingDiagnosis: seed.hasMedicalConsultation ? false : true,
        hasReferral: seed.hasMedicalConsultation,
        referredHealthCenterId: seed.hasMedicalConsultation
          ? referredHealthCenter.id
          : null,
        referralNotProvidedReason: seed.hasMedicalConsultation
          ? null
          : 'Aun no cuenta con referencia.',
        nextConsultationDate: seed.hasMedicalConsultation
          ? toDateOnly(addDays(now, index + 7))
          : null,
        consultationStatus: seed.hasMedicalConsultation
          ? MedicalConsultationStatus.ATTENDED
          : MedicalConsultationStatus.NOT_OBTAINED,
        consultationNotObtainedReason: seed.hasMedicalConsultation
          ? null
          : 'Pendiente de conseguir cita.',
        healthCenterId: seed.hasMedicalConsultation ? healthCenter.id : null,
        specialty: seed.hasMedicalConsultation ? 'Medicina general' : null,
        diagnosisSearchDuration: normalizeDuration({
          valueMin: seed.hasMedicalConsultation ? 1 : 3,
          unit: DurationUnit.MONTH,
        }),
        hasReceivedDiagnosis:
          seed.diagnosisStatus === PatientDiagnosticStatus.CONFIRMED,
        reportedDiagnosis:
          seed.diagnosisStatus === PatientDiagnosticStatus.CONFIRMED
            ? seed.diagnosis
            : null,
        isReceivingReportedTreatment: seed.isOncologicalPatient ? true : false,
        reportedTreatment: seed.isOncologicalPatient
          ? 'Tratamiento en evaluacion'
          : null,
        reportedTreatmentFrequency: seed.isOncologicalPatient
          ? normalizeDuration({ valueMin: 1, unit: DurationUnit.MONTH })
          : normalizeDuration(null),
        notReceivingTreatmentReason: seed.isOncologicalPatient
          ? null
          : 'No aplica tratamiento oncologico.',
      });
    }),
  );
}

async function seedDiagnosticStatusEvents(
  manager: EntityManager,
  patients: Patient[],
  followUps: FollowUp[],
  now: Date,
): Promise<PatientDiagnosticStatusEvent[]> {
  return manager.save(
    patients.map((patient, index) => {
      const seed = PATIENT_SEEDS[index];
      return manager.create(PatientDiagnosticStatusEvent, {
        patientId: patient.id,
        followUpId: followUps[index].id,
        status: seed.diagnosisStatus,
        occurredAt: atTime(addDays(now, -(index + 2)), 11),
        reportedDiagnosis:
          seed.diagnosisStatus === PatientDiagnosticStatus.CONFIRMED
            ? seed.diagnosis
            : null,
        diagnosisId: null,
        supportedBySepa: index % 2 === 0,
        notes: 'Estado diagnostico creado por el seed local.',
      });
    }),
  );
}

async function seedNonOncologicalFollowUps(
  manager: EntityManager,
  patients: Patient[],
  followUps: FollowUp[],
  enrollments: Enrollment[],
  events: PatientDiagnosticStatusEvent[],
  now: Date,
): Promise<PatientNonOncologicalFollowUp[]> {
  return manager.save(
    patients
      .slice(1, 10)
      .filter((_, index) => index % 2 === 0)
      .map((patient, offset) => {
        const patientIndex = offset * 2 + 1;
        const discharged = offset === 2;
        return manager.create(PatientNonOncologicalFollowUp, {
          patientId: patient.id,
          followUpId: followUps[patientIndex].id,
          enrollmentId: enrollments[patientIndex].id,
          diagnosticStatusEventId: events[patientIndex].id,
          diagnosis: PATIENT_SEEDS[patientIndex].diagnosis,
          occurredOn: toDateOnly(addDays(now, -(patientIndex + 2))),
          receivesTreatment: offset !== 1,
          treatmentName: offset !== 1 ? 'Manejo ambulatorio' : null,
          medication:
            offset !== 1 ? 'Medicacion indicada por medicina general' : null,
          treatmentFrequency:
            offset !== 1
              ? normalizeDuration({ valueMin: 1, unit: DurationUnit.DAY })
              : normalizeDuration(null),
          hasControls: true,
          controlSpecialty: 'Medicina general',
          controlPeriodicity: normalizeDuration({
            valueMin: 3,
            unit: DurationUnit.MONTH,
          }),
          status: discharged
            ? PatientNonOncologicalFollowUpStatus.DISCHARGED
            : PatientNonOncologicalFollowUpStatus.ACTIVE,
          dischargedOn: discharged ? toDateOnly(now) : null,
          dischargeReason: discharged ? 'Caso estabilizado.' : null,
        });
      }),
  );
}

async function report(): Promise<void> {
  const tables = [
    'users',
    'agents',
    'health_centers',
    'patients',
    'patient_details',
    'follow_ups',
    'enrollments',
    'patient_symptom_reports',
    'patient_diagnostic_status_events',
    'patient_non_oncological_follow_ups',
  ];
  const lines: string[] = [];

  for (const table of tables) {
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "${table}"`,
    );
    lines.push(`  ${table.padEnd(38)} ${count.padStart(4)}`);
  }

  console.log('\nSeed local creado:\n');
  console.log(lines.join('\n'));
  console.log(
    `\nAcceso admin: ${process.env.SEED_ADMIN_EMAIL ?? '(SEED_ADMIN_EMAIL)'}` +
      `\n             password: ${process.env.SEED_ADMIN_PASSWORD ? '(configurada)' : '(SEED_ADMIN_PASSWORD)'}\n`,
  );
}

async function seedLocal(): Promise<void> {
  if (PATIENT_SEEDS.length !== PATIENT_COUNT) {
    throw new Error(
      `Expected ${PATIENT_COUNT} local patients, got ${PATIENT_SEEDS.length}`,
    );
  }

  if (process.env.NODE_ENV === 'production' && !process.env.SEED_LOCAL_FORCE) {
    throw new Error(
      'Refusing to run the local seed with NODE_ENV=production — it deletes all data. Set SEED_LOCAL_FORCE=true to override.',
    );
  }

  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      const now = new Date();
      await resetDomainTables(manager);
      await ensureAdminUser(manager);
      const agent = await seedAgent(manager);
      const healthCenters = await seedStagingHealthCenters(manager);
      await seedCatalogItems(manager);
      await seedUbigeo(manager);
      const patients = await seedPatients(manager, healthCenters, now);
      const followUps = await seedFollowUps(manager, patients, agent, now);
      const enrollments = await seedEnrollments(
        manager,
        patients,
        followUps,
        now,
      );
      await seedSymptomReports(
        manager,
        patients,
        followUps,
        enrollments,
        healthCenters,
        now,
      );
      const events = await seedDiagnosticStatusEvents(
        manager,
        patients,
        followUps,
        now,
      );
      await seedNonOncologicalFollowUps(
        manager,
        patients,
        followUps,
        enrollments,
        events,
        now,
      );
    });

    await report();
  } finally {
    await dataSource.destroy();
  }
}

void seedLocal().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
