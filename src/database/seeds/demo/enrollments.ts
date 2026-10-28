import { AffiliationType, Enrollment } from '../../entities/enrollment.entity';
import { CatalogItem } from '../../entities/catalog-item.entity';
import { CompanionPatient } from '../../entities/companion-patient.entity';
import { CompanionTalkInterest } from '../../entities/companion-talk-interest.entity';
import { ENTRY_SOURCES, FAMILY_TALKS } from './catalog';
import type { DemoContext } from './context';
import type { PatientFollowUps } from './follow-ups';
import { addMinutes, toDateOnly } from './rng';

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
  // CH1: talks are a catalog and interest belongs to a linked companion.
  await manager
    .createQueryBuilder()
    .insert()
    .into(CatalogItem)
    .values(
      FAMILY_TALKS.map((label, index) => ({
        kind: 'educational_talk' as const,
        code: `DEMO_TALK_${index + 1}`,
        label,
        sortOrder: index + 1,
        isActive: true,
        isSystem: false,
      })),
    )
    .orIgnore()
    .execute();

  const rows: CompanionTalkInterest[] = [];
  for (const enrollment of rng.pickN(enrollments, 4)) {
    const link = await manager.findOne(CompanionPatient, {
      where: { patientId: enrollment.patientId },
    });
    if (!link) continue;
    for (const index of rng.pickN([0, 1, 2, 3, 4], rng.int(1, 2)))
      rows.push(
        manager.create(CompanionTalkInterest, {
          companionId: link.companionId,
          patientId: enrollment.patientId,
          talk: `DEMO_TALK_${index + 1}`,
          followUpId: enrollment.followUpId,
        }),
      );
  }

  await manager.save(rows);
}
