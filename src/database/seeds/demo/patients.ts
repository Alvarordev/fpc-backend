import { CompanionPatient } from '../../entities/companion-patient.entity';
import { DeactivationReason } from '../../entities/deactivation-reason.enum';
import { PatientDetails } from '../../entities/patient-details.entity';
import { PatientRole } from '../../entities/patient-role.enum';
import { PatientStatus } from '../../entities/patient-status.enum';
import { Patient } from '../../entities/patient.entity';
import type { HealthCenter } from '../../entities/health-center.entity';
import {
  DISTRICTS,
  EDUCATION_LEVELS,
  FIRST_NAMES_FEMALE,
  FIRST_NAMES_MALE,
  LAST_NAMES,
  NATIVE_LANGUAGES,
  STREET_NAMES,
  TRAVEL_TIMES,
} from './catalog';
import type { DemoContext } from './context';
import { DEMO_EMAIL_DOMAIN } from './users';
import { addDays, toDateOnly } from './rng';

export const PATIENT_COUNT = 15;
export const ENROLLED_COUNT = 11;
export const COMPANION_COUNT = 6;

export interface DemoPatient {
  patient: Patient;
  /** Present for the first `COMPANION_COUNT` patients; drives interlocutors. */
  companion: Patient | null;
  healthCenter: HealthCenter;
  isEnrolled: boolean;
}

interface Person {
  fullName: string;
  gender: 'F' | 'M';
}

export async function seedPatients(
  ctx: DemoContext,
  healthCenters: HealthCenter[],
): Promise<DemoPatient[]> {
  const { manager, rng, now } = ctx;
  // DNIs must be unique; a fixed base plus a stride keeps them plausible.
  let nextDni = 40218000;
  const takeDni = (): string => String((nextDni += rng.int(11, 97)));

  const person = (): Person => {
    const gender = rng.bool(0.62) ? 'F' : 'M';
    const firstName = rng.pick(
      gender === 'F' ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE,
    );
    const [paternal, maternal] = rng.pickN(LAST_NAMES, 2);
    return { fullName: `${firstName} ${paternal} ${maternal}`, gender };
  };

  const phone = (): string =>
    `+51 9${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`;

  // Active centers only — patients are not followed at a decommissioned one.
  const activeCenters = healthCenters.filter((center) => center.isActive);

  const patientRows: Patient[] = [];
  const assignedCenters: HealthCenter[] = [];

  for (let index = 0; index < PATIENT_COUNT; index += 1) {
    const { fullName, gender } = person();
    const isEnrolled = index < ENROLLED_COUNT;
    const center = activeCenters[index % activeCenters.length];
    assignedCenters.push(center);

    const birthDate = addDays(now, -rng.int(31, 80) * 365 - rng.int(0, 364));

    patientRows.push(
      manager.create(Patient, {
        fullName,
        // Roughly half the caseload has no email; contact is by phone.
        email: rng.bool(0.45)
          ? `${fullName.split(' ')[0].toLowerCase()}.${index + 1}@${DEMO_EMAIL_DOMAIN}`
          : null,
        dni: takeDni(),
        birthDate: toDateOnly(birthDate),
        gender,
        primaryPhone: phone(),
        secondaryPhone: rng.bool(0.4) ? phone() : null,
        hasWhatsapp: rng.bool(0.75),
        role: PatientRole.PATIENT,
        status: isEnrolled ? PatientStatus.ENROLLED : PatientStatus.UNENROLLED,
        isActive: true,
        deactivationReason: null,
        deactivationReasonDetail: null,
        deactivatedAt: null,
        deceasedAt: null,
      }),
    );
  }

  // Two deactivated cases, both enrolled, so the dashboard shows real churn.
  // The CHECK constraint on `patients` demands reason + timestamp together,
  // and a detail only when the reason is OTHER.
  const deceased = patientRows[ENROLLED_COUNT - 1];
  const deceasedAt = addDays(now, -rng.int(20, 70));
  deceased.isActive = false;
  deceased.deactivationReason = DeactivationReason.DECEASED;
  deceased.deactivatedAt = deceasedAt;
  deceased.deceasedAt = toDateOnly(deceasedAt);

  const lost = patientRows[ENROLLED_COUNT - 2];
  lost.isActive = false;
  lost.deactivationReason = DeactivationReason.LOST_CONTACT;
  lost.deactivatedAt = addDays(now, -rng.int(30, 90));

  const patients = await manager.save(patientRows);

  // Companions are patients too (role COMPANION) — they can be the person the
  // agent actually speaks to, which is what `follow_ups.interlocutor_id` models.
  const companionRows: Patient[] = [];
  for (let index = 0; index < COMPANION_COUNT; index += 1) {
    const { fullName, gender } = person();
    companionRows.push(
      manager.create(Patient, {
        fullName,
        email: null,
        dni: takeDni(),
        birthDate: toDateOnly(addDays(now, -rng.int(25, 60) * 365)),
        gender,
        primaryPhone: phone(),
        secondaryPhone: null,
        hasWhatsapp: rng.bool(0.9),
        role: PatientRole.COMPANION,
        status: PatientStatus.UNENROLLED,
        isActive: true,
      }),
    );
  }
  const companions = await manager.save(companionRows);

  await manager.save(
    companions.map((companion, index) =>
      manager.create(CompanionPatient, {
        companionId: companion.id,
        patientId: patients[index].id,
        isPrimaryInformant: true,
      }),
    ),
  );

  const demoPatients: DemoPatient[] = patients.map((patient, index) => ({
    patient,
    companion: index < COMPANION_COUNT ? companions[index] : null,
    healthCenter: assignedCenters[index],
    isEnrolled: index < ENROLLED_COUNT,
  }));

  await seedPatientDetails(ctx, demoPatients);

  return demoPatients;
}

async function seedPatientDetails(
  { manager, rng, now }: DemoContext,
  demoPatients: DemoPatient[],
): Promise<void> {
  const rows = demoPatients
    // Details are captured during enrollment, so unenrolled leads have none.
    .filter(({ isEnrolled }) => isEnrolled)
    .map(({ patient, healthCenter }) => {
      const department = healthCenter.department;
      const districts = DISTRICTS[department] ?? [department];
      const nativeLanguage = rng.pick(NATIVE_LANGUAGES);
      const droppedOut = rng.bool(0.12);

      return manager.create(PatientDetails, {
        patientId: patient.id,
        birthDepartment: department,
        currentAddress: `${rng.pick(STREET_NAMES)} ${rng.int(100, 1899)}`,
        currentDistrict: rng.pick(districts),
        currentDepartment: department,
        dniMatchesAddress: rng.maybeBool(0.65),
        travelTimeToHospital: rng.pick(TRAVEL_TIMES),
        emergencyContactName: `${rng.pick([...FIRST_NAMES_FEMALE, ...FIRST_NAMES_MALE])} ${rng.pick(LAST_NAMES)}`,
        emergencyContactPhone: `+51 9${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`,
        zoneType: rng.bool(0.7) ? 'URBANA' : 'RURAL',
        emergencyContactGender: rng.bool(0.6) ? 'F' : 'M',
        educationLevel: rng.pick(EDUCATION_LEVELS),
        nativeLanguage,
        requiresTranslation: nativeLanguage !== 'Castellano' && rng.bool(0.5),
        referredToSocialWorker: rng.maybeBool(0.55),
        evidenceOfDomesticViolence: rng.maybeBool(0.08),
        usesWoodStove: rng.maybeBool(0.25),
        isWorking: rng.maybeBool(0.35),
        receivesFinancialSupport: rng.maybeBool(0.3),
        hasConadisCard: rng.maybeBool(0.2),
        knowsAboutFissal: rng.maybeBool(0.4),
        programDropoutReason: droppedOut
          ? 'Se mudó de región y perdió contacto con el equipo.'
          : null,
        programDropoutDate: droppedOut
          ? toDateOnly(addDays(now, -rng.int(15, 120)))
          : null,
      });
    });

  await manager.save(rows);
}
