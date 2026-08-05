import type { Agent } from '../../entities/agent.entity';
import { Reminder } from '../../entities/reminder.entity';
import { ReminderStatus } from '../../entities/reminder-status.enum';
import { REMINDER_DESCRIPTIONS } from './catalog';
import type { DemoContext } from './context';
import type { PatientFollowUps } from './follow-ups';
import { addDays, addMinutes, atTime } from './rng';

const REMINDER_COUNT = 20;

export async function seedReminders(
  { manager, rng, now }: DemoContext,
  histories: PatientFollowUps[],
  agents: Agent[],
): Promise<void> {
  const rows: Reminder[] = [];

  // Only patients with an actual case history get reminders.
  const candidates = histories.filter(
    (history) => history.completed.length > 0,
  );

  for (let index = 0; index < REMINDER_COUNT; index += 1) {
    const history = candidates[index % candidates.length];
    const { patient } = history.demoPatient;
    // Keep the same agent that owns the patient's follow-ups.
    const agent = agents[histories.indexOf(history) % agents.length];
    const createdFrom = rng.pick(history.completed);

    const roll = rng.next();
    let status: ReminderStatus;
    let dueAt: Date;

    if (roll < 0.4) {
      status = ReminderStatus.PENDING;
      dueAt = atTime(addDays(now, rng.int(1, 20)), rng.int(9, 17));
    } else if (roll < 0.55) {
      // Overdue work — this is what surfaces as pressure in the call-center view.
      status = ReminderStatus.PENDING;
      dueAt = atTime(addDays(now, -rng.int(1, 12)), rng.int(9, 17));
    } else if (roll < 0.9) {
      status = ReminderStatus.DONE;
      dueAt = atTime(addDays(now, -rng.int(5, 90)), rng.int(9, 17));
    } else {
      status = ReminderStatus.DISMISSED;
      dueAt = atTime(addDays(now, -rng.int(5, 60)), rng.int(9, 17));
    }

    const isDone = status === ReminderStatus.DONE;

    rows.push(
      manager.create(Reminder, {
        subjectPatientId: patient.id,
        createdFromFollowUpId: createdFrom.id,
        assignedAgentId: agent.id,
        dueAt,
        description: rng.pick(REMINDER_DESCRIPTIONS),
        status,
        completedAt: isDone ? addMinutes(dueAt, rng.int(30, 600)) : null,
        // A completed reminder usually produced the next conversation.
        resultingFollowUpId: isDone ? rng.pick(history.completed).id : null,
      }),
    );
  }

  await manager.save(rows);
}
