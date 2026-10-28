import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { MedicalAppointmentStatus } from '../../database/entities/medical-appointment-status.enum';
import { Patient } from '../../database/entities/patient.entity';
import { PatientMedicalAppointment } from '../../database/entities/patient-medical-appointment.entity';
import {
  ReminderChannel,
  ReminderDeliveryStatus,
  ReminderLead,
} from '../../database/entities/reminder-delivery.enums';
import { ReminderKind } from '../../database/entities/reminder-kind.enum';
import { ReminderStatus } from '../../database/entities/reminder-status.enum';
import { Reminder } from '../../database/entities/reminder.entity';

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DEFAULT_APPOINTMENT_TIME = '08:00';

export const DEFAULT_APPOINTMENT_REMINDER_LEAD = ReminderLead.ONE_DAY;

export function appointmentStartsAt(date: string, time?: string | null): Date {
  const hhmm = (time ?? DEFAULT_APPOINTMENT_TIME).slice(0, 5);
  return new Date(`${date}T${hhmm}:00-05:00`);
}

export function timeInLima(value: Date): string {
  return new Date(value.getTime() - LIMA_OFFSET_MS).toISOString().slice(11, 16);
}

export function computeRemindAt(
  startsAt: Date,
  lead: ReminderLead,
  customRemindAt?: string | Date | null,
): Date {
  if (lead === ReminderLead.CUSTOM) {
    if (!customRemindAt)
      throw new BadRequestException('Indica la fecha del recordatorio personalizado.');
    const custom = new Date(customRemindAt);
    if (custom > startsAt)
      throw new BadRequestException('El recordatorio no puede ser posterior a la cita.');
    return custom;
  }
  const leadMs =
    lead === ReminderLead.TWO_HOURS ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(startsAt.getTime() - leadMs);
}

export interface AppointmentReminderOptions {
  lead?: ReminderLead;
  remindAt?: string | Date | null;
  channel?: ReminderChannel;
  description?: string | null;
  assignedAgentId?: string | null;
  createdFromFollowUpId?: string | null;
}

/**
 * Every future scheduled appointment gets an informative reminder. Returns
 * null when the appointment does not qualify (past, not scheduled, or no
 * agent to own the reminder).
 */
export async function createAppointmentReminder(
  manager: EntityManager,
  appointment: PatientMedicalAppointment,
  options: AppointmentReminderOptions = {},
): Promise<Reminder | null> {
  if (
    appointment.isHistorical ||
    appointment.status !== MedicalAppointmentStatus.SCHEDULED ||
    !appointment.appointmentDate
  )
    return null;
  const startsAt = appointmentStartsAt(
    appointment.appointmentDate,
    appointment.appointmentTime,
  );
  const now = new Date();
  if (startsAt <= now) return null;

  const assignedAgentId =
    options.assignedAgentId ??
    (appointment.followUpId
      ? (
          await manager
            .getRepository(FollowUp)
            .findOneBy({ id: appointment.followUpId })
        )?.agentId
      : null);
  if (!assignedAgentId) return null;

  const lead = options.lead ?? DEFAULT_APPOINTMENT_REMINDER_LEAD;
  const computed = computeRemindAt(startsAt, lead, options.remindAt);
  const channel =
    options.channel ??
    ((
      await manager.getRepository(Patient).findOne({
        where: { id: appointment.patientId },
        select: { id: true, email: true },
      })
    )?.email
      ? ReminderChannel.EMAIL
      : ReminderChannel.MANUAL);

  // A new version for the same specialty supersedes the previous booking.
  await manager.query(
    `UPDATE reminders r
        SET status = $4, updated_at = now()
       FROM patient_medical_appointments a
      WHERE r.medical_appointment_id = a.id
        AND a.patient_id = $1 AND a.specialty = $2 AND a.id <> $3
        AND r.kind = $5 AND r.status = $6`,
    [
      appointment.patientId,
      appointment.specialty,
      appointment.id,
      ReminderStatus.DISMISSED,
      ReminderKind.MEDICAL_APPOINTMENT,
      ReminderStatus.PENDING,
    ],
  );

  const repository = manager.getRepository(Reminder);
  const reminder = await repository.save(
    repository.create({
      subjectPatientId: appointment.patientId,
      createdFromFollowUpId:
        options.createdFromFollowUpId ?? appointment.followUpId ?? null,
      assignedAgentId,
      dueAt: startsAt,
      dueOn: appointment.appointmentDate,
      description:
        options.description?.trim() || `Cita: ${appointment.specialty}`,
      kind: ReminderKind.MEDICAL_APPOINTMENT,
      medicalAppointmentId: appointment.id,
      status: ReminderStatus.PENDING,
      completedOn: null,
      channel,
      lead,
      remindAt: computed < now ? now : computed,
      deliveryStatus: ReminderDeliveryStatus.PENDING,
      sentAt: null,
      deliveryError: null,
      isHistorical: false,
    }),
  );
  await manager
    .getRepository(PatientMedicalAppointment)
    .update({ id: appointment.id }, { reminderId: reminder.id });
  appointment.reminderId = reminder.id;
  return reminder;
}

/**
 * Keeps the reminder of an appointment aligned after the appointment is
 * edited (new version): re-points it, moves dueAt and recomputes remindAt.
 * Creates one when a future scheduled appointment still has none.
 */
export async function syncAppointmentReminder(
  manager: EntityManager,
  appointment: PatientMedicalAppointment,
  options: AppointmentReminderOptions = {},
): Promise<Reminder | null> {
  const repository = manager.getRepository(Reminder);
  const reminder = appointment.reminderId
    ? await repository.findOneBy({ id: appointment.reminderId })
    : null;
  if (!reminder)
    return createAppointmentReminder(manager, appointment, options);
  if (
    reminder.status !== ReminderStatus.PENDING ||
    !appointment.appointmentDate
  )
    return reminder;

  const startsAt = appointmentStartsAt(
    appointment.appointmentDate,
    appointment.appointmentTime,
  );
  reminder.medicalAppointmentId = appointment.id;
  if (reminder.dueAt?.getTime() !== startsAt.getTime()) {
    const lead =
      options.lead ?? reminder.lead ?? DEFAULT_APPOINTMENT_REMINDER_LEAD;
    const custom =
      options.remindAt ??
      (lead === ReminderLead.CUSTOM ? reminder.remindAt : null);
    const remindAt = computeRemindAt(
      startsAt,
      lead === ReminderLead.CUSTOM && !custom
        ? DEFAULT_APPOINTMENT_REMINDER_LEAD
        : lead,
      custom,
    );
    const now = new Date();
    reminder.dueAt = startsAt;
    reminder.dueOn = appointment.appointmentDate;
    reminder.lead = lead;
    reminder.remindAt = remindAt < now ? now : remindAt;
    reminder.deliveryStatus = ReminderDeliveryStatus.PENDING;
    reminder.sentAt = null;
    reminder.deliveryError = null;
  }
  return repository.save(reminder);
}
