import { N8nWebhookEnvelope } from './n8n-webhook.events';

// Field keys and casing are exactly what fpc-back sent (Spanish, mixed
// case DNI/snake_case centro_salud) — n8n's workflow matches on these
// literally, so they must not be "cleaned up" by a refactor.

export interface AlertWebhookSnapshot {
  ticketNumber: string;
  patientFullName: string;
  patientDni: string;
  patientPhone: string;
  title: string;
  description: string;
  healthCenterName: string;
  severity: string;
}

export function buildAlertaEnvelope(
  s: AlertWebhookSnapshot,
): N8nWebhookEnvelope {
  return {
    var: 'Alerta',
    query: {
      nombre: s.patientFullName,
      DNI: s.patientDni,
      celular: s.patientPhone,
      titulo: s.title,
      descripcion: s.description,
      centro_salud: s.healthCenterName,
      gravedad: s.severity,
      ticket: s.ticketNumber,
    },
  };
}

export function buildAlertaResueltaEnvelope(
  s: AlertWebhookSnapshot,
): N8nWebhookEnvelope {
  return {
    var: 'AlertaResuelta',
    query: {
      nombre: s.patientFullName,
      DNI: s.patientDni,
      celular: s.patientPhone,
      titulo: `Alerta resuelta: ${s.title}`,
      descripcion: s.description,
      centro_salud: s.healthCenterName,
      gravedad: s.severity,
      ticket: s.ticketNumber,
    },
  };
}

export interface AlertDerivationWebhookSnapshot {
  ticketNumber: string;
  patientFullName: string;
  patientDni: string;
  patientPhone: string;
  title: string;
  derivedTo: string;
  healthCenterName: string;
  severity: string;
}

export function buildAlertaDerivarEnvelope(
  s: AlertDerivationWebhookSnapshot,
): N8nWebhookEnvelope {
  return {
    var: 'AlertaDerivar',
    query: {
      nombre: s.patientFullName,
      DNI: s.patientDni,
      celular: s.patientPhone,
      titulo: `Alerta derivada: ${s.title}`,
      descripcion: `Alerta derivada a: ${s.derivedTo}`,
      centro_salud: s.healthCenterName,
      gravedad: s.severity,
      ticket: s.ticketNumber,
    },
  };
}

export interface AppointmentWebhookSnapshot {
  patientFullName: string;
  patientDni: string;
  patientPhone: string;
  patientEmail: string | null;
  difficulties: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  specialty: string | null;
}

export function buildCitaEnvelope(
  s: AppointmentWebhookSnapshot,
): N8nWebhookEnvelope {
  return {
    var: 'Cita',
    query: {
      nombre: s.patientFullName,
      DNI: s.patientDni,
      celular: s.patientPhone,
      // Deviation from fpc-back (which always sent ''): this backend's
      // Patient entity actually has an email column, so use it.
      correo: s.patientEmail ?? '',
      motivo: s.difficulties ?? 'Cita médica programada',
      fecha: s.appointmentDate ?? '',
      hora: s.appointmentTime ? s.appointmentTime.slice(0, 5) : '',
      especialidad: s.specialty ?? 'General',
    },
  };
}

export interface PatientRegisteredWebhookSnapshot {
  fullName: string;
  dni: string;
  phone: string;
  email: string | null;
  diagnosis: string;
  condition: 'acompañante' | 'paciente';
}

export function buildRegistroEnvelope(
  s: PatientRegisteredWebhookSnapshot,
): N8nWebhookEnvelope {
  return {
    var: 'Registro',
    query: {
      nombre: s.fullName,
      DNI: s.dni,
      celular: s.phone,
      correo: s.email ?? '',
      diagnostico: s.diagnosis,
      condicion: s.condition,
    },
  };
}
