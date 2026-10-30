export enum FollowUpType {
  WHATSAPP = 'WHATSAPP',
  CALL = 'CALL',
  VIDEO_CALL = 'VIDEO_CALL',
  EMAIL = 'EMAIL',
  IN_PERSON = 'IN_PERSON',
  FACEBOOK = 'FACEBOOK',
}
export enum FollowUpStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_ANSWER = 'NO_ANSWER',
  OVERDUE = 'OVERDUE',
}
export enum FollowUpPurpose {
  FIRST_CONTACT = 'FIRST_CONTACT',
  ENROLLMENT = 'ENROLLMENT',
  FOLLOW_UP = 'FOLLOW_UP',
  PSYCHOONCOLOGY_REFERRAL = 'PSYCHOONCOLOGY_REFERRAL',
  /** Paciente inactivo que vuelve al programa: se reactiva desde este seguimiento. */
  REENROLLMENT = 'REENROLLMENT',
  OTHER = 'OTHER',
}
export enum FollowUpAttemptOutcome {
  CONTACTED = 'CONTACTED',
  NO_ANSWER = 'NO_ANSWER',
  WRONG_NUMBER = 'WRONG_NUMBER',
  REJECTED = 'REJECTED',
}
