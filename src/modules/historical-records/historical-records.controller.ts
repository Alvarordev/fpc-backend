import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Enrollment } from '../../database/entities/enrollment.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { PsychooncologyAppointment } from '../../database/entities/psychooncology-appointment.entity';
import { Reminder } from '../../database/entities/reminder.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { EnrollmentResponseDto } from '../enrollments/dto/enrollment-response.dto';
import { FollowUpResponseDto } from '../follow-ups/dto/follow-up-response.dto';
import {
  ReminderMedicalAppointmentSummaryDto,
  ReminderResponseDto,
} from '../reminders/dto/reminder-response.dto';
import { PatientMedicalAppointmentResponseDto } from '../patients/clinical/medical-appointments/dto/patient-medical-appointment-response.dto';
import { PsychooncologyAppointmentResponseDto } from '../psychooncology-appointments/dto/psychooncology-appointment-response.dto';
import { CreateHistoricalEnrollmentDto } from './dto/create-historical-enrollment.dto';
import { CreateHistoricalFollowUpDto } from './dto/create-historical-follow-up.dto';
import { CreateHistoricalMedicalAppointmentDto } from './dto/create-historical-medical-appointment.dto';
import { CreateHistoricalPsychooncologyAppointmentDto } from './dto/create-historical-psychooncology-appointment.dto';
import { CreateHistoricalReminderDto } from './dto/create-historical-reminder.dto';
import { HistoricalRecordsService } from './historical-records.service';

@Controller('historical-records')
@ApiTags('historical-records')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class HistoricalRecordsController {
  constructor(private readonly service: HistoricalRecordsService) {}

  @Post('enrollments')
  @ApiOperation({ summary: 'Create a historical enrollment' })
  @ApiCreatedResponse({ type: EnrollmentResponseDto })
  @ApiBadRequestResponse({ description: 'Historical enrollment is invalid' })
  @ApiForbiddenResponse({ description: 'Only administrators may load history' })
  @ApiNotFoundResponse({ description: 'A referenced record was not found' })
  createEnrollment(
    @Body() input: CreateHistoricalEnrollmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service
      .createEnrollment(input, user)
      .then(this.toEnrollmentResponse);
  }

  @Post('follow-ups')
  @ApiOperation({ summary: 'Create a historical follow-up' })
  @ApiCreatedResponse({ type: FollowUpResponseDto })
  @ApiBadRequestResponse({ description: 'Historical follow-up is invalid' })
  @ApiForbiddenResponse({ description: 'Only administrators may load history' })
  @ApiNotFoundResponse({ description: 'A referenced record was not found' })
  createFollowUp(
    @Body() input: CreateHistoricalFollowUpDto,
    @CurrentUser() user: User,
  ) {
    return this.service
      .createFollowUp(input, user)
      .then(this.toFollowUpResponse);
  }

  @Post('reminders')
  @ApiOperation({ summary: 'Create a historical reminder' })
  @ApiCreatedResponse({ type: ReminderResponseDto })
  @ApiBadRequestResponse({ description: 'Historical reminder is invalid' })
  @ApiForbiddenResponse({ description: 'Only administrators may load history' })
  @ApiNotFoundResponse({ description: 'A referenced record was not found' })
  createReminder(
    @Body() input: CreateHistoricalReminderDto,
    @CurrentUser() user: User,
  ) {
    return this.service
      .createReminder(input, user)
      .then(this.toReminderResponse);
  }

  @Post('medical-appointments')
  @ApiOperation({ summary: 'Create a historical medical appointment' })
  @ApiCreatedResponse({ type: PatientMedicalAppointmentResponseDto })
  @ApiBadRequestResponse({ description: 'Historical appointment is invalid' })
  @ApiForbiddenResponse({ description: 'Only administrators may load history' })
  @ApiNotFoundResponse({ description: 'A referenced record was not found' })
  createMedicalAppointment(
    @Body() input: CreateHistoricalMedicalAppointmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service
      .createMedicalAppointment(input, user)
      .then((item) => PatientMedicalAppointmentResponseDto.from(item));
  }

  @Post('psychooncology-appointments')
  @ApiOperation({ summary: 'Create a historical psycho-oncology appointment' })
  @ApiCreatedResponse({ type: PsychooncologyAppointmentResponseDto })
  @ApiBadRequestResponse({ description: 'Historical appointment is invalid' })
  @ApiForbiddenResponse({ description: 'Only administrators may load history' })
  @ApiNotFoundResponse({ description: 'A referenced record was not found' })
  createPsychooncologyAppointment(
    @Body() input: CreateHistoricalPsychooncologyAppointmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service
      .createPsychooncologyAppointment(input, user)
      .then(this.toPsychooncologyResponse);
  }

  private toEnrollmentResponse(
    this: void,
    item: Enrollment,
  ): EnrollmentResponseDto {
    return {
      id: item.id,
      patientId: item.patientId,
      followUpId: item.followUpId,
      enrolledOn: item.enrolledOn,
      affiliationType: item.affiliationType,
      companionId: item.companionId,
      currentlyAttendingConsultations: item.currentlyAttendingConsultations,
      currentlyReceivingTreatment: item.currentlyReceivingTreatment,
      entrySource: item.entrySource,
      entrySubSource: item.entrySubSource,
      consentToContact: item.consentToContact,
      consentToShareData: item.consentToShareData,
      requiresTransportation: item.requiresTransportation,
      hasMobilityIssues: item.hasMobilityIssues,
      isOncologicalPatient: item.isOncologicalPatient,
      surveyAccepted: item.surveyAccepted,
      caseComments: item.caseComments,
      callStartedAt: item.callStartedAt,
      callEndedAt: item.callEndedAt,
      followUpQualityRating: item.followUpQualityRating,
      isHistorical: item.isHistorical,
      createdAt: item.createdAt,
    };
  }

  private toFollowUpResponse(this: void, item: FollowUp): FollowUpResponseDto {
    return {
      id: item.id,
      subjectPatientId: item.subjectPatientId,
      subjectPatientName: item.subjectPatient?.fullName ?? null,
      interlocutorId: item.interlocutorId,
      agentId: item.agentId,
      type: item.type,
      status: item.status,
      purpose: item.purpose,
      scheduledAt: item.scheduledAt,
      scheduledOn: item.scheduledOn,
      completedAt: item.completedAt,
      completedOn: item.completedOn,
      notes: item.notes,
      nextFollowUpId: item.nextFollowUpId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isHistorical: item.isHistorical,
    };
  }

  private toReminderResponse(this: void, item: Reminder): ReminderResponseDto {
    const appointment = item.medicalAppointment;
    const medicalAppointment: ReminderMedicalAppointmentSummaryDto | null =
      appointment
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
        : null;
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
      medicalAppointment,
      status: item.status,
      completedAt: item.completedAt,
      completedOn: item.completedOn,
      resultingFollowUpId: item.resultingFollowUpId,
      createdAt: item.createdAt,
      isHistorical: item.isHistorical,
    };
  }

  private toPsychooncologyResponse(
    this: void,
    item: PsychooncologyAppointment,
  ): PsychooncologyAppointmentResponseDto {
    return {
      id: item.id,
      patientId: item.patientId,
      beneficiaryType: item.beneficiaryType,
      companionId: item.companionId,
      companionFullName: item.companion?.fullName ?? null,
      volunteerId: item.volunteerId,
      volunteerFullName: item.volunteer
        ? `${item.volunteer.firstName} ${item.volunteer.lastName}`
        : 'Voluntario no identificado',
      followUpId: item.followUpId,
      availabilityId: item.availabilityId,
      patientEmail: item.patientEmail,
      zoomLink: item.zoomLink,
      sessionNumber: item.sessionNumber,
      isAdditionalSession: item.isAdditionalSession,
      modality: item.modality,
      status: item.status,
      scheduledAt: item.scheduledAt,
      scheduledOn: item.scheduledOn,
      completedAt: item.completedAt,
      completedOn: item.completedOn,
      topicAddressed: item.topicAddressed,
      sessionDetails: item.sessionDetails,
      additionalObservations: item.additionalObservations,
      recommendations: item.recommendations,
      referral: item.referral,
      schedulingNotes: item.schedulingNotes,
      noAnswerNote: item.noAnswerNote,
      satisfactionRating: item.satisfactionRating,
      satisfactionComment: item.satisfactionComment,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isHistorical: item.isHistorical,
    };
  }
}
