import { AffiliationType, Enrollment } from '../../entities/enrollment.entity';
import { EnrollmentFamilyTalkInterest } from '../../entities/enrollment-family-talk-interest.entity';
import {
  ENTRY_SOURCES,
  FAMILY_TALKS,
  FIRST_NAMES_FEMALE,
  FIRST_NAMES_MALE,
  LAST_NAMES,
} from './catalog';
import type { DemoContext } from './context';
import type { PatientFollowUps } from './follow-ups';
import { addMinutes, toDateOnly } from './rng';
import { DEMO_EMAIL_DOMAIN } from './users';

/** Keyed by patient id — the clinical-history step needs the enrollment back. */
export async function seedEnrollments(
  ctx: DemoContext,
  histories: PatientFollowUps[],
): Promise<Map<string, Enrollment>> {
  const { manager, rng } = ctx;
  const rows: Enrollment[] = [];

  for (const history of histories) {
    if (!history.enrollment) continue;

    const { patient, companion } = history.demoPatient;
    const entry = rng.pick(ENTRY_SOURCES);
    const callStartedAt =
      history.enrollment.completedAt ?? history.enrollment.scheduledAt;

    rows.push(
      manager.create(Enrollment, {
        patientId: patient.id,
        followUpId: history.enrollment.id,
        enrolledOn: toDateOnly(callStartedAt ?? history.enrollment.createdAt),
        affiliationType: companion
          ? AffiliationType.FAMILY_FRIEND
          : AffiliationType.SELF,
        companionId: companion?.id ?? null,
        currentlyAttendingConsultations: rng.maybeBool(0.75, 0.05),
        currentlyReceivingTreatment: rng.maybeBool(0.7, 0.05),
        entrySource: entry.source,
        entrySubSource: rng.pick(entry.subSources),
        // Consent is what unlocks contact, so nearly everyone enrolled granted it.
        consentToContact: true,
        consentToShareData: rng.bool(0.85),
        requiresTransportation: rng.maybeBool(0.4),
        hasMobilityIssues: rng.maybeBool(0.2),
        isOncologicalPatient: true,
        surveyAccepted: rng.bool(0.7),
        caseComments: rng.pick([
          'Caso derivado por trabajo social del hospital.',
          'Requiere apoyo para gestionar el traslado desde su distrito.',
          'La familia asume los costos de los exámenes complementarios.',
          'Paciente con buen soporte familiar y adherencia al tratamiento.',
        ]),
        callStartedAt,
        callEndedAt: callStartedAt
          ? addMinutes(callStartedAt, rng.int(10, 40))
          : null,
        followUpQualityRating: rng.int(3, 5),
      }),
    );
  }

  const enrollments = await manager.save(rows);

  await seedFamilyTalkInterests(ctx, enrollments);

  return new Map(
    enrollments.map((enrollment) => [enrollment.patientId, enrollment]),
  );
}

async function seedFamilyTalkInterests(
  { manager, rng }: DemoContext,
  enrollments: Enrollment[],
): Promise<void> {
  const rows: EnrollmentFamilyTalkInterest[] = [];

  for (const enrollment of rng.pickN(enrollments, 4)) {
    for (const talkName of rng.pickN(FAMILY_TALKS, rng.int(1, 2))) {
      const familyMemberName = `${rng.pick([...FIRST_NAMES_FEMALE, ...FIRST_NAMES_MALE])} ${rng.pick(LAST_NAMES)}`;
      rows.push(
        manager.create(EnrollmentFamilyTalkInterest, {
          enrollmentId: enrollment.id,
          talkName,
          familyMemberName,
          familyMemberPhone: `+51 9${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`,
          familyMemberEmail: rng.bool(0.5)
            ? `${familyMemberName.split(' ')[0].toLowerCase()}.familiar@${DEMO_EMAIL_DOMAIN}`
            : null,
        }),
      );
    }
  }

  await manager.save(rows);
}
