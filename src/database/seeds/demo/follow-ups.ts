import type { Agent } from '../../entities/agent.entity';
import { FollowUp } from '../../entities/follow-up.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../../entities/follow-up.enums';
import { CANCELLED_NOTES, FOLLOW_UP_NOTES, NO_ANSWER_NOTES } from './catalog';
import type { DemoContext } from './context';
import type { DemoPatient } from './patients';
import { addDays, addMinutes, atTime } from './rng';

/** How far back the case history goes. */
const HISTORY_DAYS = 240;

const CONTACT_TYPES: readonly FollowUpType[] = [
  FollowUpType.CALL,
  FollowUpType.CALL,
  FollowUpType.WHATSAPP,
  FollowUpType.WHATSAPP,
  FollowUpType.VIDEO_CALL,
  FollowUpType.IN_PERSON,
  FollowUpType.EMAIL,
  FollowUpType.FACEBOOK,
];

export interface PatientFollowUps {
  demoPatient: DemoPatient;
  /** Chronological, oldest first. */
  followUps: FollowUp[];
  firstContact: FollowUp;
  /** The follow-up the enrollment record hangs off; null when unenrolled. */
  enrollment: FollowUp | null;
  psychoReferral: FollowUp | null;
  completed: FollowUp[];
}

interface FollowUpPlan {
  purpose: FollowUpPurpose;
  status: FollowUpStatus;
  scheduledAt: Date;
}

export async function seedFollowUps(
  ctx: DemoContext,
  demoPatients: DemoPatient[],
  agents: Agent[],
): Promise<PatientFollowUps[]> {
  const { manager, rng } = ctx;

  const plansByPatient = demoPatients.map((demoPatient) =>
    planFollowUps(ctx, demoPatient),
  );

  const rows: FollowUp[] = [];
  const rangeByPatient: { start: number; end: number }[] = [];

  plansByPatient.forEach((plans, patientIndex) => {
    const { patient, companion } = demoPatients[patientIndex];
    // Each patient keeps the same assigned agent across their history — that is
    // what makes the call-center workload view meaningful.
    const agent = agents[patientIndex % agents.length];
    const start = rows.length;

    for (const plan of plans) {
      const isCompleted = plan.status === FollowUpStatus.COMPLETED;
      const notes = noteFor(ctx, plan.status, plan.purpose);

      rows.push(
        manager.create(FollowUp, {
          subjectPatientId: patient.id,
          // Companions often answer on the patient's behalf.
          interlocutorId:
            companion && rng.bool(0.4) ? companion.id : patient.id,
          agentId: agent.id,
          type: rng.pick(CONTACT_TYPES),
          status: plan.status,
          purpose: plan.purpose,
          scheduledAt: plan.scheduledAt,
          completedAt: isCompleted
            ? addMinutes(plan.scheduledAt, rng.int(0, 45))
            : null,
          notes,
        }),
      );
    }

    rangeByPatient.push({ start, end: rows.length });
  });

  const saved = await manager.save(rows);

  // Chain each follow-up to the next one in the same patient's history.
  const links: FollowUp[] = [];
  for (const { start, end } of rangeByPatient) {
    for (let index = start; index < end - 1; index += 1) {
      saved[index].nextFollowUpId = saved[index + 1].id;
      links.push(saved[index]);
    }
  }
  await manager.save(links);

  return demoPatients.map((demoPatient, patientIndex) => {
    const { start, end } = rangeByPatient[patientIndex];
    const followUps = saved.slice(start, end);
    const find = (purpose: FollowUpPurpose): FollowUp | null =>
      followUps.find((followUp) => followUp.purpose === purpose) ?? null;

    return {
      demoPatient,
      followUps,
      firstContact: followUps[0],
      enrollment: find(FollowUpPurpose.ENROLLMENT),
      psychoReferral: find(FollowUpPurpose.PSYCHOONCOLOGY_REFERRAL),
      completed: followUps.filter(
        (followUp) => followUp.status === FollowUpStatus.COMPLETED,
      ),
    };
  });
}

/**
 * Builds a plausible case history: first contact, then enrollment, then a run
 * of periodic follow-ups, and for active patients an upcoming scheduled one.
 */
function planFollowUps(
  { rng, now }: DemoContext,
  { patient, isEnrolled }: DemoPatient,
): FollowUpPlan[] {
  const plans: FollowUpPlan[] = [];
  const historyStart = addDays(now, -HISTORY_DAYS);

  const at = (date: Date): Date =>
    atTime(date, rng.int(9, 17), rng.pick([0, 15, 30, 45]));

  let cursor = addDays(historyStart, rng.int(0, 40));
  plans.push({
    purpose: FollowUpPurpose.FIRST_CONTACT,
    status: FollowUpStatus.COMPLETED,
    scheduledAt: at(cursor),
  });

  if (!isEnrolled) {
    // Leads that never enrolled: one or two unproductive attempts.
    const attempts = rng.int(0, 1);
    for (let index = 0; index < attempts; index += 1) {
      cursor = addDays(cursor, rng.int(3, 14));
      plans.push({
        purpose: FollowUpPurpose.OTHER,
        status: rng.bool(0.6)
          ? FollowUpStatus.NO_ANSWER
          : FollowUpStatus.COMPLETED,
        scheduledAt: at(cursor),
      });
    }
    return plans;
  }

  cursor = addDays(cursor, rng.int(2, 10));
  plans.push({
    purpose: FollowUpPurpose.ENROLLMENT,
    status: FollowUpStatus.COMPLETED,
    scheduledAt: at(cursor),
  });

  const periodicCount = rng.int(1, 3);
  for (let index = 0; index < periodicCount; index += 1) {
    cursor = addDays(cursor, rng.int(18, 40));
    if (cursor >= now) break;

    const roll = rng.next();
    plans.push({
      purpose: FollowUpPurpose.FOLLOW_UP,
      status:
        roll < 0.72
          ? FollowUpStatus.COMPLETED
          : roll < 0.9
            ? FollowUpStatus.NO_ANSWER
            : FollowUpStatus.CANCELLED,
      scheduledAt: at(cursor),
    });
  }

  if (rng.bool(0.4)) {
    cursor = addDays(cursor, rng.int(7, 25));
    if (cursor < now) {
      plans.push({
        purpose: FollowUpPurpose.PSYCHOONCOLOGY_REFERRAL,
        status: FollowUpStatus.COMPLETED,
        scheduledAt: at(cursor),
      });
    }
  }

  // Only patients still in the program have something on the calendar.
  if (patient.isActive && rng.bool(0.55)) {
    plans.push({
      purpose: FollowUpPurpose.FOLLOW_UP,
      status: FollowUpStatus.SCHEDULED,
      scheduledAt: at(addDays(now, rng.int(1, 21))),
    });
  }

  return plans;
}

function noteFor(
  { rng }: DemoContext,
  status: FollowUpStatus,
  purpose: FollowUpPurpose,
): string | null {
  if (status === FollowUpStatus.NO_ANSWER) return rng.pick(NO_ANSWER_NOTES);
  if (status === FollowUpStatus.CANCELLED) return rng.pick(CANCELLED_NOTES);
  if (status === FollowUpStatus.SCHEDULED) return null;
  return rng.pick(FOLLOW_UP_NOTES[purpose]);
}
