import { Reminder } from '../../database/entities/reminder.entity';
import { ReminderKind } from '../../database/entities/reminder-kind.enum';

const SIGNATURE = 'Programa SEPA - Fundación Peruana de Cáncer';

// Date-only values (YYYY-MM-DD) read as "viernes 30 de octubre de 2026".
export function formatDateEs(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    dateStyle: 'full',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * `specialtyLabel` is the readable label from the medical_specialty catalog;
 * the appointment row only stores the catalog code (e.g. ONCOLOGIA_MEDICA).
 */
export function buildReminderMessage(
  item: Reminder,
  specialtyLabel?: string | null,
): {
  subject: string;
  text: string;
} {
  const name = item.subjectPatient?.fullName?.trim();
  const greeting = name ? `Hola ${name},` : 'Hola,';
  const appointment = item.medicalAppointment;

  if (item.kind === ReminderKind.MEDICAL_APPOINTMENT && appointment) {
    const when = [
      appointment.appointmentDate
        ? `el ${formatDateEs(appointment.appointmentDate)}`
        : null,
      appointment.appointmentTime
        ? `a las ${appointment.appointmentTime.slice(0, 5)}`
        : null,
    ]
      .filter(Boolean)
      .join(' ');
    const where = appointment.healthCenter?.name
      ? ` en ${appointment.healthCenter.name}`
      : '';
    const specialty = specialtyLabel?.trim() || appointment.specialty;
    return {
      subject: 'Recordatorio de cita médica',
      text: `${greeting} te recordamos tu cita de ${specialty}${where}${when ? ` ${when}` : ''}. Si no podrás asistir, avísanos.\n\n${SIGNATURE}`,
    };
  }

  return {
    subject: 'Recordatorio',
    text: `${greeting} te recordamos: ${item.description}\n\n${SIGNATURE}`,
  };
}
