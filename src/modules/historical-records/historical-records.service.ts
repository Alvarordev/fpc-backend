import { Injectable } from '@nestjs/common';
import { User } from '../../database/entities/user.entity';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { PatientMedicalAppointmentsService } from '../patients/clinical/medical-appointments/patient-medical-appointments.service';
import { PsychooncologyAppointmentsService } from '../psychooncology-appointments/psychooncology-appointments.service';
import { RemindersService } from '../reminders/reminders.service';
import { CreateHistoricalEnrollmentDto } from './dto/create-historical-enrollment.dto';
import { CreateHistoricalFollowUpDto } from './dto/create-historical-follow-up.dto';
import { CreateHistoricalMedicalAppointmentDto } from './dto/create-historical-medical-appointment.dto';
import { CreateHistoricalPsychooncologyAppointmentDto } from './dto/create-historical-psychooncology-appointment.dto';
import { CreateHistoricalReminderDto } from './dto/create-historical-reminder.dto';

@Injectable()
export class HistoricalRecordsService {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly followUps: FollowUpsService,
    private readonly reminders: RemindersService,
    private readonly medicalAppointments: PatientMedicalAppointmentsService,
    private readonly psychooncologyAppointments: PsychooncologyAppointmentsService,
  ) {}

  createEnrollment(input: CreateHistoricalEnrollmentDto, user: User) {
    return this.enrollments.createHistorical(input, user.id, user.role);
  }

  createFollowUp(input: CreateHistoricalFollowUpDto, user: User) {
    return this.followUps.createHistorical(input, user.id, user.role);
  }

  createReminder(input: CreateHistoricalReminderDto, user: User) {
    return this.reminders.createHistorical(input, user.id);
  }

  createMedicalAppointment(
    input: CreateHistoricalMedicalAppointmentDto,
    user: User,
  ) {
    return this.medicalAppointments.createHistorical(input, user.id);
  }

  createPsychooncologyAppointment(
    input: CreateHistoricalPsychooncologyAppointmentDto,
    user: User,
  ) {
    return this.psychooncologyAppointments.createHistorical(input, user.id);
  }
}
