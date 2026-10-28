import { Reminder } from '../../database/entities/reminder.entity';
import { ReminderKind } from '../../database/entities/reminder-kind.enum';

const SIGNATURE = 'Programa SEPA - Fundación Peruana de Cáncer';

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function buildReminderMessage(item: Reminder): {
  subject: string;
  text: string;
} {
  const name = item.subjectPatient?.fullName?.trim();
  const greeting = name ? `Hola ${name},` : 'Hola,';
  const appointment = item.medicalAppointment;

  if (item.kind === ReminderKind.MEDICAL_APPOINTMENT && appointment) {
    const when = [
      appointment.appointmentDate
        ? `el ${formatDate(appointment.appointmentDate)}`
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
    return {
      subject: 'Recordatorio de cita médica',
      text: `${greeting} te recordamos tu cita de ${appointment.specialty}${where}${when ? ` ${when}` : ''}. Si no podrás asistir, avísanos.\n\n${SIGNATURE}`,
    };
  }

  return {
    subject: 'Recordatorio',
    text: `${greeting} te recordamos: ${item.description}\n\n${SIGNATURE}`,
  };
}
