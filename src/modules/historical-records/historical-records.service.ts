import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { PatientAddressesService } from '../patients/addresses/patient-addresses.service';
import { PatientDiagnosesService } from '../patients/clinical/diagnoses/patient-diagnoses.service';
import { PatientHealthBackgroundAssessmentsService } from '../patients/clinical/health-background/patient-health-background-assessments.service';
import { PatientInsuranceService } from '../patients/clinical/insurance/patient-insurance.service';
import { PatientMedicalAppointmentsService } from '../patients/clinical/medical-appointments/patient-medical-appointments.service';
import { PatientSisAffiliationService } from '../patients/clinical/sis-affiliation/patient-sis-affiliation.service';
import { PatientTreatmentsService } from '../patients/clinical/treatments/patient-treatments.service';
import { PatientsService } from '../patients/patients.service';
import { PatientSocialNotesService } from '../patients/social-notes/patient-social-notes.service';
import { PatientSymptomReportsService } from '../patients/symptom-reports/patient-symptom-reports.service';
import { PsychooncologyAppointmentsService } from '../psychooncology-appointments/psychooncology-appointments.service';
import { RemindersService } from '../reminders/reminders.service';
import { CreateHistoricalEnrollmentDto } from './dto/create-historical-enrollment.dto';
import {
  CreateHistoricalFollowUpDto,
  UpdateHistoricalFollowUpDto,
} from './dto/create-historical-follow-up.dto';
import { CreateHistoricalMedicalAppointmentDto } from './dto/create-historical-medical-appointment.dto';
import { CreateHistoricalPsychooncologyAppointmentDto } from './dto/create-historical-psychooncology-appointment.dto';
import {
  CreateHistoricalReminderDto,
  UpdateHistoricalReminderDto,
} from './dto/create-historical-reminder.dto';
import { UpdateHistoricalPsychooncologyAppointmentDto } from './dto/update-historical-psychooncology-appointment.dto';
import {
  attachHistoricalClinicalData,
  upsertHistoricalClinicalData,
  type HistoricalClinicalServices,
} from './historical-clinical.util';

@Injectable()
export class HistoricalRecordsService {
  private readonly clinical: HistoricalClinicalServices;

  constructor(
    private readonly dataSource: DataSource,
    private readonly enrollments: EnrollmentsService,
    private readonly followUps: FollowUpsService,
    private readonly reminders: RemindersService,
    private readonly medicalAppointments: PatientMedicalAppointmentsService,
    private readonly psychooncologyAppointments: PsychooncologyAppointmentsService,
    patients: PatientsService,
    diagnoses: PatientDiagnosesService,
    treatments: PatientTreatmentsService,
    insurance: PatientInsuranceService,
    sisAffiliations: PatientSisAffiliationService,
    symptomReports: PatientSymptomReportsService,
    addresses: PatientAddressesService,
    healthBackgroundAssessments: PatientHealthBackgroundAssessmentsService,
    socialNotes: PatientSocialNotesService,
  ) {
    this.clinical = {
      patients,
      diagnoses,
      treatments,
      insurance,
      sisAffiliations,
      symptomReports,
      addresses,
      healthBackgroundAssessments,
      socialNotes,
    };
  }

  createEnrollment(input: CreateHistoricalEnrollmentDto, user: User) {
    return this.enrollments.createHistorical(input, user.id, user.role);
  }

  async createFollowUp(input: CreateHistoricalFollowUpDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const {
        details,
        diagnoses,
        treatments,
        symptomReport,
        healthBackgroundAssessment,
        insurance,
        sisAffiliation,
        addresses,
        socialNotes,
        ...followUpInput
      } = input;

      const created = await this.followUps.createHistorical(
        followUpInput,
        user.id,
        user.role,
        manager,
      );

      await attachHistoricalClinicalData(
        this.clinical,
        manager,
        created.subjectPatientId,
        created.id,
        {
          details,
          diagnoses,
          treatments,
          symptomReport,
          healthBackgroundAssessment,
          insurance,
          sisAffiliation,
          addresses,
          socialNotes,
        },
        user.id,
      );

      return this.followUps.findOne(created.id, manager);
    });
  }

  async updateFollowUp(
    id: string,
    input: UpdateHistoricalFollowUpDto,
    user: User,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const {
        details,
        diagnoses,
        treatments,
        symptomReport,
        healthBackgroundAssessment,
        insurance,
        sisAffiliation,
        addresses,
        socialNotes,
        ...metadata
      } = input;

      const updated = await this.followUps.updateHistoricalMetadata(
        id,
        metadata,
        manager,
      );

      await upsertHistoricalClinicalData(
        this.clinical,
        manager,
        updated.subjectPatientId,
        updated.id,
        {
          details,
          diagnoses,
          treatments,
          symptomReport,
          healthBackgroundAssessment,
          insurance,
          sisAffiliation,
          addresses,
          socialNotes,
        },
        user.id,
      );

      return this.followUps.findOne(updated.id, manager);
    });
  }

  createReminder(input: CreateHistoricalReminderDto, user: User) {
    return this.reminders.createHistorical(input, user.id);
  }

  updateReminder(id: string, input: UpdateHistoricalReminderDto, user: User) {
    return this.reminders.updateHistorical(id, input, user.id);
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

  updatePsychooncologyAppointment(
    id: string,
    input: UpdateHistoricalPsychooncologyAppointmentDto,
    user: User,
  ) {
    return this.psychooncologyAppointments.updateHistorical(id, input, user.id);
  }
}
