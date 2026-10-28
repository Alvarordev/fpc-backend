# Diff de contrato API (develop -> refactor/redefinicion)

Generado desde openapi/openapi.json. Fuente de verdad para adaptar el front.

## Endpoints nuevos
- GET /alerts/{id}/affected-patients
- POST /alerts/{id}/affected-patients/notify
- PATCH /alerts/{id}/derive
- POST /alerts/{id}/reports
- GET /alerts/{id}/reports
- POST /call-center/reassign
- GET /catalogs/merges
- POST /catalogs/{id}/merge-into/{targetId}
- GET /dashboard/indicators/satisfaction
- GET /exports/patients
- POST /follow-ups/{id}/attempts
- POST /follow-ups/{id}/reschedule
- GET /patients/{patientId}/change-log
- POST /patients/{patientId}/referrals
- GET /patients/{patientId}/referrals
- GET /patients/{patientId}/referrals/route
- PATCH /patients/{patientId}/referrals/{id}
- GET /patients/{patientId}/referrals/{id}
- DELETE /patients/{patientId}/referrals/{id}
- GET /psychooncology-appointments/needs-reassignment
- GET /psychooncology-appointments/patients/{patientId}/unmanaged-no-shows
- PATCH /psychooncology-appointments/{id}/no-show-managed
- GET /psychooncology-appointments/{id}/reminder
- PATCH /psychooncology-appointments/{id}/reminder/sent
- POST /psychooncology-appointments/{id}/reschedule
- GET /psychooncology-cycles
- PATCH /psychooncology-cycles/{id}/close
- POST /reminders/{id}/mark-sent
- GET /reminders/{id}/message
- POST /reminders/{id}/send-email
- POST /surveys
- GET /surveys
- GET /surveys/pending/three-months
- GET /surveys/script
- GET /volunteers/me
- DELETE /volunteers/{volunteerId}/availability/recurrences/{recurrenceId}
- POST /volunteers/{volunteerId}/availability/recurring

- POST /assistant/messages
- GET /assistant/conversations
- GET /assistant/conversations/{id}
- DELETE /assistant/conversations/{id}

- POST /follow-ups/{id}/reenrollment
- GET /follow-ups/{id}/reenrollment

- PATCH /patients/{id}/companions/{companionId}/person
- POST /patients/{id}/companions/{companionId}/convert-to-patient

## Endpoints eliminados
- PATCH /patients/{id}/reactivate (se reactiva solo con POST /follow-ups/{id}/reenrollment)

## Schemas con propiedades cambiadas
- AlertEventResponseDto: +['actorName', 'actorUserId'] -[] enum cambiado en ['eventType']
- AlertResponseDto: +['categoryLabel', 'derivedAt', 'derivedToLabel', 'reportsCount', 'resolutionNotes'] -['resolvedById', 'underReview'] enum cambiado en ['status', 'category']
- CallCenterFollowUpDto: +['scheduledOn', 'status'] -[]
- CallCenterReminderDto: +['dueOn'] -[]
- CallCenterWorkloadResponseDto: +['load', 'today', 'weekEnd'] -[]
- CompleteReminderDto: +[] -['resultingFollowUpId']
- CreateAlertDto: +[] -[] enum cambiado en ['category']
- CreateCatalogItemDto: +[] -[] enum cambiado en ['kind']
- CreateEnrollmentDto: +[] -['diagnosis']
- CreateHealthCenterDto: +['careCategory', 'institution', 'renipressCode', 'ubigeoDistrictCode'] -['category']
- CreateHistoricalEnrollmentDto: +[] -['diagnosis']
- CreateHistoricalFollowUpDto: +[] -[] enum cambiado en ['status']
- CreateHistoricalPsychooncologyAppointmentDto: +[] -[] enum cambiado en ['status']
- CreateHistoricalReminderDto: +[] -['resultingFollowUpId']
- CreateMedicalAppointmentDto: +['reminderAt', 'reminderChannel', 'reminderLead'] -[]
- CreatePatientMedicalAppointmentDto: +['reminderAt', 'reminderChannel', 'reminderLead'] -[]
- CreatePsychooncologyAppointmentDto: +['remindAt', 'reminderMode'] -[]
- CreateReminderDto: +['channel', 'lead', 'remindAt'] -[]
- DashboardAbandonmentResponseDto: +['dropoutsInPeriod', 'transferredOut', 'reenrolledInPeriod'] -[]
- FollowUpPurpose: +REENROLLMENT; catálogo nuevo reenrollment_reason; POST /enrollments y la carga histórica con un paciente ya enrolado responden 409 (PATIENT_REENROLL_VIA_FOLLOW_UP si está inactivo, PATIENT_ALREADY_ENROLLED si no); patientId + patient juntos ya no se admiten
- DashboardAdherenceResponseDto: +['treatmentAbandonmentReasons'] -[]
- DashboardDemographicsResponseDto: +['insuranceTypeAtEnrollment'] -[]
- DashboardEpidemiologyResponseDto: +['diagnosisByDepartment', 'diagnosisByStage'] -[]
- DashboardIndicatorMetaDto: +['definitions'] -[]
- DeactivatePatientDto: +['followUpId'] -['detail'] enum cambiado en ['reason']
- EnrollmentMedicalAppointmentDto: +['reminderAt', 'reminderChannel', 'reminderLead'] -[]
- FollowUpResponseDto: +['attempts'] -[] enum cambiado en ['status']
- FollowUpTimelineEventDto: +[] -[] enum cambiado en ['status']
- HealthCenterResponseDto: +['careCategory', 'careLevel', 'institution', 'renipressCode', 'ubigeoDistrictCode'] -['category']
- HistoricalEnrollmentFollowUpDto: +[] -[] enum cambiado en ['status']
- PatientDetailsResponseDto: +[] -['programDropoutDate', 'programDropoutReason', 'programDropoutReasonCode']
- PatientDetailsWithSummaryResponseDto: +[] -[] enum cambiado en ['deactivationReason']
- PatientListItemResponseDto: +[] -[] enum cambiado en ['deactivationReason']
- PatientResponseDto: +[] -[] enum cambiado en ['deactivationReason']
- PsychooncologyAppointmentResponseDto: +['cycleId', 'needsReassignment', 'noShowManagedAt', 'noShowManagedById', 'remindAt', 'reminderMode', 'reminderSentAt', 'rescheduledToId'] -[] enum cambiado en ['status']
- PsychooncologyAppointmentTimelineEventDto: +[] -[] enum cambiado en ['status']
- ReminderResponseDto: +['channel', 'deliveryError', 'deliveryStatus', 'lead', 'remindAt', 'sentAt'] -['resultingFollowUpId']
- UpdateAlertDto: +[] -['derivationNotes', 'derivedTo', 'followUpId', 'underReview'] enum cambiado en ['status', 'category']
- UpdateFollowUpDto: +[] -[] enum cambiado en ['status']
- UpdateHealthCenterDto: +['careCategory', 'institution', 'renipressCode', 'ubigeoDistrictCode'] -['category']
- UpdateHistoricalFollowUpDto: +[] -[] enum cambiado en ['status']
- UpdateHistoricalPsychooncologyAppointmentDto: +[] -[] enum cambiado en ['status']
- UpdateHistoricalReminderDto: +[] -['resultingFollowUpId']
- UpdatePsychooncologyAppointmentDto: +['isAdditionalSession', 'remindAt', 'reminderMode'] -['availabilityId'] enum cambiado en ['status']
- UpdateReminderDto: +['channel', 'lead', 'remindAt'] -[]
- UpsertPatientDetailsDto: +[] -['programDropoutDate', 'programDropoutReason', 'programDropoutReasonCode']
- VolunteerAvailabilityResponseDto: +['recurrenceId'] -[]
- VolunteerCalendarAppointmentDto: +[] -[] enum cambiado en ['status']

- POST /patients/{id}/companions devuelve CompanionResponseDto (antes PatientResponseDto); CompanionPatientResponseDto.companion es CompanionResponseDto. PatientRole ya no tiene COMPANION. relationship es un código del catálogo companion_relationship.

## Schemas nuevos
- AlertAffectedPatientDto
- AlertAffectedPatientsResponseDto
- AlertNotifyPatientsResponseDto
- AlertReportResponseDto
- AppointmentReminderResponseDto
- CallCenterAgentLoadDto
- CallCenterPendingCountsDto
- CatalogMergeResponseDto
- ChangeLogEntryResponseDto
- ChangeLogPageResponseDto
- ClosePsychooncologyCycleDto
- CreateFollowUpAttemptDto
- CreateRecurringAvailabilityDto
- CreateReferralDto
- CreateSurveyDto
- DashboardCrossItemDto
- DashboardSatisfactionResponseDto
- DashboardSurveySummaryDto
- DeriveAlertDto
- FollowUpAttemptResponseDto
- LinkAlertReportDto
- PendingThreeMonthSurveyDto
- PsychooncologyCycleResponseDto
- ReactivatePatientDto
- ReassignFollowUpsDto
- ReassignFollowUpsResponseDto
- RecurringAvailabilityResponseDto
- ReferralHealthCenterDto
- ReferralResponseDto
- ReminderMessageResponseDto
- RemoveRecurrenceResponseDto
- RescheduleFollowUpDto
- ReschedulePsychooncologyAppointmentDto
- ResolveAlertDto
- SurveyResponseDto
- SurveyScriptResponseDto
- UnmanagedNoShowsResponseDto
- UpdateReferralDto
