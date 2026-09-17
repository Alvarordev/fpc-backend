import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MedicalAppointmentStatus } from '../../database/entities/medical-appointment-status.enum';
import { MedicalConsultationStatus } from '../../database/entities/medical-consultation-status.enum';
import { PatientDiagnosisMode } from '../../database/entities/patient-diagnosis-mode.enum';
import { PatientDiagnosticStatus } from '../../database/entities/patient-diagnostic-status.enum';
import { PatientDiagnosticStatusEvent } from '../../database/entities/patient-diagnostic-status-event.entity';
import { CatalogValueService } from '../catalogs/catalog-value.service';
import { PatientDiagnosesService } from './clinical/diagnoses/patient-diagnoses.service';
import { PatientMedicalAppointmentsService } from './clinical/medical-appointments/patient-medical-appointments.service';
import { PatientNonOncologicalFollowUpsService } from './clinical/non-oncological-follow-up/patient-non-oncological-follow-ups.service';
import { PatientTreatmentsService } from './clinical/treatments/patient-treatments.service';
import { CreatePatientSymptomReportDto } from './symptom-reports/dto/create-patient-symptom-report.dto';

export type SymptomFanOutOptions = {
  skipAppointment?: boolean;
  historical?: boolean;
  historicalLoadedById?: string;
};

@Injectable()
export class ClinicalOwnershipService {
  constructor(
    private readonly catalogValues: CatalogValueService,
    private readonly appointments: PatientMedicalAppointmentsService,
    private readonly diagnoses: PatientDiagnosesService,
    private readonly treatments: PatientTreatmentsService,
    private readonly nonOncological: PatientNonOncologicalFollowUpsService,
  ) {}

  stripOwnershipFields(
    input: CreatePatientSymptomReportDto,
  ): CreatePatientSymptomReportDto {
    return {
      ...input,
      healthCenterId: undefined,
      specialty: undefined,
      firstConsultationDate: undefined,
      nextConsultationDate: undefined,
      hasReferral: undefined,
      referredHealthCenterId: undefined,
      referralNotProvidedReason: undefined,
      isAwaitingDiagnosis: undefined,
      hasReceivedDiagnosis: undefined,
      reportedDiagnosis: undefined,
      reportedTreatment: undefined,
      reportedTreatmentFrequency: undefined,
      isReceivingReportedTreatment: undefined,
      notReceivingTreatmentReason: undefined,
    };
  }

  async fanOutFromSymptomReport(
    patientId: string,
    followUpId: string,
    enrollmentId: string | null,
    input: CreatePatientSymptomReportDto,
    manager: EntityManager,
    options: SymptomFanOutOptions = {},
  ): Promise<void> {
    if (!options.skipAppointment) {
      await this.deriveAppointment(patientId, followUpId, input, manager);
    }
    await this.deriveDiagnosisAndTreatment(
      patientId,
      followUpId,
      enrollmentId,
      input,
      manager,
    );
  }

  private shouldCreateAppointment(input: CreatePatientSymptomReportDto): boolean {
    if (input.hasMedicalConsultation === true) return true;
    return (
      input.consultationStatus === MedicalConsultationStatus.SCHEDULED ||
      input.consultationStatus === MedicalConsultationStatus.ATTENDED
    );
  }

  private async deriveAppointment(
    patientId: string,
    followUpId: string,
    input: CreatePatientSymptomReportDto,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.shouldCreateAppointment(input)) return;
    if (!input.specialty || !input.healthCenterId) return;

    const attended =
      input.hasMedicalConsultation === true ||
      input.consultationStatus === MedicalConsultationStatus.ATTENDED;
    await this.appointments.create(
      patientId,
      {
        followUpId,
        specialty: input.specialty,
        healthCenterId: input.healthCenterId,
        appointmentDate: input.firstConsultationDate,
        nextAppointmentDate: input.nextConsultationDate,
        hasReferralSheet: input.hasReferral,
        referredHealthCenterId: input.referredHealthCenterId,
        referralNotProvidedReason: input.referralNotProvidedReason,
        isFirstConsultation: attended,
        status: attended
          ? MedicalAppointmentStatus.COMPLETED
          : MedicalAppointmentStatus.SCHEDULED,
      },
      manager,
      !attended,
    );
  }

  private async deriveDiagnosisAndTreatment(
    patientId: string,
    followUpId: string,
    enrollmentId: string | null,
    input: CreatePatientSymptomReportDto,
    manager: EntityManager,
  ): Promise<void> {
    if (input.hasReceivedDiagnosis !== true || !input.reportedDiagnosis?.trim())
      return;

    const oncological = await this.catalogValues.tryResolve(
      'cancer_diagnosis',
      input.reportedDiagnosis,
      { manager },
    );
    const events = manager.getRepository(PatientDiagnosticStatusEvent);

    if (oncological) {
      const diagnosis = await this.diagnoses.create(
        patientId,
        {
          followUpId,
          diagnosis: oncological.code,
          diagnosisOther: oncological.other ?? undefined,
          mode: PatientDiagnosisMode.PARALLEL,
          healthCenterId: input.healthCenterId,
          diagnosisSpecialty: input.specialty,
        },
        manager,
      );
      await events.save(
        events.create({
          patientId,
          followUpId,
          status: PatientDiagnosticStatus.CONFIRMED,
          occurredAt: new Date(),
          reportedDiagnosis: oncological.code,
          diagnosisId: diagnosis.id,
        }),
      );
      if (input.isReceivingReportedTreatment === true && input.reportedTreatment) {
        const treatmentType = await this.catalogValues.tryResolve(
          'treatment_type',
          input.reportedTreatment,
          { manager },
        );
        await this.treatments.create(
          patientId,
          {
            followUpId,
            diagnosisId: diagnosis.id,
            treatmentType: treatmentType?.code ?? 'OTRO',
            treatmentTypeOther: treatmentType
              ? (treatmentType.other ?? undefined)
              : input.reportedTreatment,
            treatmentFrequency: input.reportedTreatmentFrequency,
          },
          manager,
        );
      }
      return;
    }

    const event = await events.save(
      events.create({
        patientId,
        followUpId,
        status: PatientDiagnosticStatus.RULED_OUT,
        occurredAt: new Date(),
        reportedDiagnosis: input.reportedDiagnosis,
        diagnosisId: null,
      }),
    );
    await this.nonOncological.create(
      patientId,
      {
        followUpId,
        enrollmentId,
        diagnosticStatusEventId: event.id,
        diagnosis: input.reportedDiagnosis,
        receivesTreatment: input.isReceivingReportedTreatment ?? null,
        treatmentName:
          input.isReceivingReportedTreatment === true
            ? input.reportedTreatment
            : null,
        treatmentFrequency:
          input.isReceivingReportedTreatment === true
            ? input.reportedTreatmentFrequency
            : null,
      },
      manager,
    );
  }
}
