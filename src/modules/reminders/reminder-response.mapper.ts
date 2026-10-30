import { Reminder } from '../../database/entities/reminder.entity';
import { ReminderResponseDto } from './dto/reminder-response.dto';

export function toReminderResponse(item: Reminder): ReminderResponseDto {
  const appointment = item.medicalAppointment;
  return {
    id: item.id,
    subjectPatientId: item.subjectPatientId,
    createdFromFollowUpId: item.createdFromFollowUpId,
    assignedAgentId: item.assignedAgentId,
    dueAt: item.dueAt,
    dueOn: item.dueOn,
    description: item.description,
    kind: item.kind,
    medicalAppointmentId: item.medicalAppointmentId,
    medicalAppointment: appointment
      ? {
          id: appointment.id,
          specialty: appointment.specialty,
          healthCenterId: appointment.healthCenterId,
          healthCenterName: appointment.healthCenter?.name ?? null,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          status: appointment.status,
          isFirstConsultation: appointment.isFirstConsultation,
        }
      : null,
    status: item.status,
    completedAt: item.completedAt,
    completedOn: item.completedOn,
    channel: item.channel,
    lead: item.lead,
    remindAt: item.remindAt,
    deliveryStatus: item.deliveryStatus,
    sentAt: item.sentAt,
    deliveryError: item.deliveryError,
    createdAt: item.createdAt,
    isHistorical: item.isHistorical,
  };
}
