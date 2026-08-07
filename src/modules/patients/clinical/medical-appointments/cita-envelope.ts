import { Patient } from '../../../../database/entities/patient.entity';
import { PatientMedicalAppointment } from '../../../../database/entities/patient-medical-appointment.entity';
import { buildCitaEnvelope } from '../../../../integrations/n8n/n8n-webhook.payloads';
import type { N8nWebhookEnvelope } from '../../../../integrations/n8n/n8n-webhook.events';

/**
 * Both the flat (`/medical-appointments`) and the patient-scoped
 * (`/patients/:id/medical-appointments`) services notify n8n with the same
 * snapshot, so the mapping from patient + appointment to the envelope lives
 * here rather than being restated in each.
 */
export function citaEnvelopeFor(
  patient: Pick<Patient, 'fullName' | 'dni' | 'primaryPhone' | 'email'>,
  appointment: Pick<
    PatientMedicalAppointment,
    'difficulties' | 'appointmentDate' | 'appointmentTime' | 'specialty'
  >,
): N8nWebhookEnvelope {
  return buildCitaEnvelope({
    patientFullName: patient.fullName,
    patientDni: patient.dni ?? '',
    patientPhone: patient.primaryPhone,
    patientEmail: patient.email,
    difficulties: appointment.difficulties,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    specialty: appointment.specialty,
  });
}
