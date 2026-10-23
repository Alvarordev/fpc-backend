export const PATIENT_DATA_CHANGED = 'patient.data-changed';

export class PatientDataChangedEvent {
  constructor(readonly patientId: string) {}
}
