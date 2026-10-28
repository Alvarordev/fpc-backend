/**
 * Single source for why a patient left the program (patients cache and
 * patient_activity_events). OTHER is legacy only and requires a detail.
 */
export enum DeactivationReason {
  VOLUNTARY = 'VOLUNTARY',
  UNLOCATABLE = 'UNLOCATABLE',
  DECEASED = 'DECEASED',
  TRANSFERRED_OUT = 'TRANSFERRED_OUT',
  OTHER = 'OTHER',
}
