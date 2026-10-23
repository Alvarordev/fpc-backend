import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { Alert } from '../../database/entities/alert.entity';
import { AlertEvent } from '../../database/entities/alert-event.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { PatientAddress } from '../../database/entities/patient-address.entity';
import { PatientDiagnosis } from '../../database/entities/patient-diagnosis.entity';
import { PatientDiagnosticStatusEvent } from '../../database/entities/patient-diagnostic-status-event.entity';
import { PatientInsurance } from '../../database/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../../database/entities/patient-medical-appointment.entity';
import { PatientNonOncologicalFollowUp } from '../../database/entities/patient-non-oncological-follow-up.entity';
import { PatientPsychooncologySupportAssessment } from '../../database/entities/patient-psychooncology-support-assessment.entity';
import { PatientSisAffiliation } from '../../database/entities/patient-sis-affiliation.entity';
import { PatientSocialNote } from '../../database/entities/patient-social-note.entity';
import { PatientSymptomReport } from '../../database/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../../database/entities/patient-treatment.entity';
import { PsychooncologyAppointment } from '../../database/entities/psychooncology-appointment.entity';
import { Reminder } from '../../database/entities/reminder.entity';
import { TreatmentMedication } from '../../database/entities/treatment-medication.entity';
import {
  PatientActiveComorbidity,
  PatientFamilyCancerHistory,
  PatientHealthBackgroundAssessment,
  PatientLimitation,
} from '../../database/entities/patient-health-background-assessment.entity';
import { PatientDiagnosesService } from '../patients/clinical/diagnoses/patient-diagnoses.service';
import { PatientInsuranceService } from '../patients/clinical/insurance/patient-insurance.service';
import { PatientSisAffiliationService } from '../patients/clinical/sis-affiliation/patient-sis-affiliation.service';
import { PatientTreatmentsService } from '../patients/clinical/treatments/patient-treatments.service';
import { PatientSymptomReportsService } from '../patients/symptom-reports/patient-symptom-reports.service';
import { PatientAddressesService } from '../patients/addresses/patient-addresses.service';
import { PatientHealthBackgroundAssessmentsService } from '../patients/clinical/health-background/patient-health-background-assessments.service';
import { PatientSocialNotesService } from '../patients/social-notes/patient-social-notes.service';
import { PatientNonOncologicalFollowUpsService } from '../patients/clinical/non-oncological-follow-up/patient-non-oncological-follow-ups.service';
import { PatientDiagnosticStatusesService } from '../patients/diagnostic-status/patient-diagnostic-statuses.service';
import { PatientsService } from '../patients/patients.service';
import type {
  CreateHistoricalFollowUpDto,
  HistoricalFollowUpTreatmentDto,
  UpdateHistoricalFollowUpDto,
} from './dto/create-historical-follow-up.dto';

type ClinicalCreateInput = Pick<
  CreateHistoricalFollowUpDto,
  | 'details'
  | 'diagnoses'
  | 'treatments'
  | 'symptomReport'
  | 'nonOncologicalFollowUp'
  | 'healthBackgroundAssessment'
  | 'insurance'
  | 'sisAffiliation'
  | 'addresses'
  | 'socialNotes'
>;

type ClinicalUpdateInput = Pick<
  UpdateHistoricalFollowUpDto,
  | 'details'
  | 'diagnoses'
  | 'treatments'
  | 'symptomReport'
  | 'nonOncologicalFollowUp'
  | 'healthBackgroundAssessment'
  | 'insurance'
  | 'sisAffiliation'
  | 'addresses'
  | 'socialNotes'
>;

export interface HistoricalClinicalServices {
  patients: PatientsService;
  diagnoses: PatientDiagnosesService;
  treatments: PatientTreatmentsService;
  insurance: PatientInsuranceService;
  sisAffiliations: PatientSisAffiliationService;
  symptomReports: PatientSymptomReportsService;
  nonOncologicalFollowUps: PatientNonOncologicalFollowUpsService;
  diagnosticStatuses: PatientDiagnosticStatusesService;
  addresses: PatientAddressesService;
  healthBackgroundAssessments: PatientHealthBackgroundAssessmentsService;
  socialNotes: PatientSocialNotesService;
}

export async function attachHistoricalClinicalData(
  services: HistoricalClinicalServices,
  manager: EntityManager,
  patientId: string,
  followUpId: string,
  input: ClinicalCreateInput,
  authorId: string,
) {
  if (input.details)
    await upsertHistoricalDetails(
      services,
      manager,
      patientId,
      followUpId,
      input.details,
    );

  const createdDiagnoses = new Map<string, PatientDiagnosis>();
  for (const diagnosisInput of input.diagnoses ?? []) {
    const { clientRef, ...diagnosisValues } = diagnosisInput;
    const created = await services.diagnoses.create(
      patientId,
      { ...diagnosisValues, followUpId },
      manager,
    );
    if (clientRef) createdDiagnoses.set(clientRef, created);
  }

  await persistTreatments(
    services,
    manager,
    patientId,
    followUpId,
    input.treatments ?? [],
    createdDiagnoses,
  );

  if (input.insurance)
    await services.insurance.create(
      patientId,
      { ...input.insurance, followUpId },
      manager,
    );
  if (input.sisAffiliation)
    await services.sisAffiliations.create(
      patientId,
      { ...input.sisAffiliation, followUpId },
      manager,
    );
  if (input.symptomReport)
    await services.symptomReports.create(
      patientId,
      { ...input.symptomReport, followUpId },
      manager,
    );
  await recordHistoricalDiagnosticSearch(
    services,
    manager,
    patientId,
    followUpId,
    input.symptomReport,
  );
  if (input.nonOncologicalFollowUp)
    await services.nonOncologicalFollowUps.upsertHistorical(
      patientId,
      followUpId,
      input.nonOncologicalFollowUp,
      manager,
    );
  if (input.healthBackgroundAssessment)
    await services.healthBackgroundAssessments.create(
      patientId,
      { ...input.healthBackgroundAssessment, followUpId },
      manager,
    );
  for (const address of input.addresses ?? [])
    await services.addresses.create(
      patientId,
      { ...address, followUpId },
      manager,
    );
  for (const note of input.socialNotes ?? [])
    await services.socialNotes.create(
      patientId,
      { ...note, followUpId },
      authorId,
      manager,
    );
}

export async function upsertHistoricalClinicalData(
  services: HistoricalClinicalServices,
  manager: EntityManager,
  patientId: string,
  followUpId: string,
  input: ClinicalUpdateInput,
  authorId: string,
) {
  if (input.details)
    await upsertHistoricalDetails(
      services,
      manager,
      patientId,
      followUpId,
      input.details,
    );

  const createdDiagnoses = new Map<string, PatientDiagnosis>();
  for (const diagnosisInput of input.diagnoses ?? []) {
    const { id, clientRef, ...values } = diagnosisInput;
    if (id) {
      const repository = manager.getRepository(PatientDiagnosis);
      const existing = await repository.findOne({
        where: { id, patientId, followUpId },
      });
      if (!existing)
        throw new NotFoundException(
          'Diagnosis not found for this historical follow-up',
        );
      const updatable = Object.fromEntries(
        Object.entries(values).filter(
          ([key]) => key !== 'mode' && key !== 'replacementDiagnosisId',
        ),
      );
      await repository.save(Object.assign(existing, updatable));
      if (clientRef) createdDiagnoses.set(clientRef, existing);
      continue;
    }
    const created = await services.diagnoses.create(
      patientId,
      { ...values, followUpId },
      manager,
    );
    if (clientRef) createdDiagnoses.set(clientRef, created);
  }

  for (const treatmentInput of input.treatments ?? []) {
    const { id, diagnosisRef, diagnosisId, ...values } =
      treatmentInput as HistoricalFollowUpTreatmentDto & { id?: string };
    if (id) {
      const repository = manager.getRepository(PatientTreatment);
      const existing = await repository.findOne({
        where: { id, patientId, followUpId },
      });
      if (!existing)
        throw new NotFoundException(
          'Treatment not found for this historical follow-up',
        );
      if (diagnosisId) existing.diagnosisId = diagnosisId;
      Object.assign(existing, values);
      await repository.save(existing);
      continue;
    }
    await persistTreatments(
      services,
      manager,
      patientId,
      followUpId,
      [{ ...values, diagnosisRef, diagnosisId }],
      createdDiagnoses,
    );
  }

  if (input.insurance) {
    const { id, ...values } = input.insurance;
    if (id) {
      const repository = manager.getRepository(PatientInsurance);
      const existing = await repository.findOne({
        where: { id, patientId, followUpId },
      });
      if (!existing)
        throw new NotFoundException(
          'Insurance not found for this historical follow-up',
        );
      await repository.save(Object.assign(existing, values));
    } else {
      await services.insurance.create(
        patientId,
        { ...values, followUpId },
        manager,
      );
    }
  }

  if (input.sisAffiliation) {
    const { id, ...values } = input.sisAffiliation;
    if (id) {
      const repository = manager.getRepository(PatientSisAffiliation);
      const existing = await repository.findOne({
        where: { id, patientId, followUpId },
      });
      if (!existing)
        throw new NotFoundException(
          'SIS affiliation not found for this historical follow-up',
        );
      await repository.save(Object.assign(existing, values));
    } else {
      await services.sisAffiliations.create(
        patientId,
        { ...values, followUpId },
        manager,
      );
    }
  }

  if (input.symptomReport) {
    const { id, ...values } = input.symptomReport;
    if (id) {
      const repository = manager.getRepository(PatientSymptomReport);
      const existing = await repository.findOne({
        where: { id, patientId, followUpId },
      });
      if (!existing)
        throw new NotFoundException(
          'Symptom report not found for this historical follow-up',
        );
      await repository.save(Object.assign(existing, values));
    } else {
      await services.symptomReports.create(
        patientId,
        { ...values, followUpId },
        manager,
      );
    }
  }
  await recordHistoricalDiagnosticSearch(
    services,
    manager,
    patientId,
    followUpId,
    input.symptomReport,
  );

  if (input.nonOncologicalFollowUp)
    await services.nonOncologicalFollowUps.upsertHistorical(
      patientId,
      followUpId,
      input.nonOncologicalFollowUp,
      manager,
    );

  if (input.healthBackgroundAssessment) {
    const {
      id,
      activeComorbidities,
      limitations,
      familyCancerHistory,
      ...values
    } = input.healthBackgroundAssessment;
    if (id) {
      const repository = manager.getRepository(
        PatientHealthBackgroundAssessment,
      );
      const existing = await repository.findOne({
        where: { id, patientId, followUpId },
        relations: {
          activeComorbidities: true,
          limitations: true,
          familyCancerHistory: true,
        },
      });
      if (!existing)
        throw new NotFoundException(
          'Health background assessment not found for this historical follow-up',
        );
      Object.assign(existing, values);
      await repository.save(existing);
      if (activeComorbidities) {
        await manager.getRepository(PatientActiveComorbidity).delete({
          assessmentId: existing.id,
        });
        for (const item of activeComorbidities) {
          await manager.getRepository(PatientActiveComorbidity).save(
            manager.getRepository(PatientActiveComorbidity).create({
              ...item,
              assessmentId: existing.id,
            }),
          );
        }
      }
      if (limitations) {
        await manager
          .getRepository(PatientLimitation)
          .delete({ assessmentId: existing.id });
        for (const item of limitations) {
          await manager.getRepository(PatientLimitation).save(
            manager.getRepository(PatientLimitation).create({
              ...item,
              assessmentId: existing.id,
            }),
          );
        }
      }
      if (familyCancerHistory) {
        await manager.getRepository(PatientFamilyCancerHistory).delete({
          assessmentId: existing.id,
        });
        for (const item of familyCancerHistory) {
          await manager.getRepository(PatientFamilyCancerHistory).save(
            manager.getRepository(PatientFamilyCancerHistory).create({
              ...item,
              assessmentId: existing.id,
            }),
          );
        }
      }
    } else {
      await services.healthBackgroundAssessments.create(
        patientId,
        { ...input.healthBackgroundAssessment, followUpId },
        manager,
      );
    }
  }

  for (const addressInput of input.addresses ?? []) {
    const { id, ...values } = addressInput;
    if (id) {
      const repository = manager.getRepository(PatientAddress);
      const existing = await repository.findOne({
        where: { id, patientId },
      });
      if (!existing || existing.followUpId !== followUpId)
        throw new NotFoundException(
          'Address not found for this historical follow-up',
        );
      await repository.save(
        repository.merge(
          existing,
          await services.addresses.normalize(values, manager),
        ),
      );
    } else {
      await services.addresses.create(
        patientId,
        { ...values, followUpId },
        manager,
      );
    }
  }

  for (const noteInput of input.socialNotes ?? []) {
    const { id, ...values } = noteInput;
    if (id) {
      const repository = manager.getRepository(PatientSocialNote);
      const existing = await repository.findOne({
        where: { id, patientId, followUpId },
      });
      if (!existing)
        throw new NotFoundException(
          'Social note not found for this historical follow-up',
        );
      await repository.save(Object.assign(existing, values));
    } else {
      await services.socialNotes.create(
        patientId,
        { ...values, followUpId },
        authorId,
        manager,
      );
    }
  }
}

async function recordHistoricalDiagnosticSearch(
  services: HistoricalClinicalServices,
  manager: EntityManager,
  patientId: string,
  followUpId: string,
  symptomReport: ClinicalCreateInput['symptomReport'] | undefined,
) {
  // A historical symptom report from the canonical flow starts the same
  // diagnostic-search history as a new signs-and-symptoms enrollment. Do not
  // infer a confirmed or ruled-out result from a preliminary report.
  if (
    !symptomReport ||
    !Object.prototype.hasOwnProperty.call(
      symptomReport,
      'hasMedicalConsultation',
    )
  )
    return;

  const occurredAt = await historicalFollowUpOccurredAt(
    manager,
    patientId,
    followUpId,
  );
  if (!occurredAt) return;

  await services.diagnosticStatuses.recordSearching(
    patientId,
    followUpId,
    manager,
    occurredAt,
  );
}

/** When a historical follow-up actually happened, not when it was loaded. */
async function historicalFollowUpOccurredAt(
  manager: EntityManager,
  patientId: string,
  followUpId: string,
): Promise<Date | null> {
  const followUp = await manager.getRepository(FollowUp).findOne({
    where: { id: followUpId, subjectPatientId: patientId },
  });
  if (!followUp) return null;

  return (
    followUp.completedAt ??
    followUp.scheduledAt ??
    (followUp.completedOn
      ? new Date(`${followUp.completedOn}T12:00:00-05:00`)
      : followUp.scheduledOn
        ? new Date(`${followUp.scheduledOn}T12:00:00-05:00`)
        : null)
  );
}

/** Health phase/subcategory history must carry the follow-up's real date. */
async function upsertHistoricalDetails(
  services: HistoricalClinicalServices,
  manager: EntityManager,
  patientId: string,
  followUpId: string,
  details: NonNullable<ClinicalCreateInput['details']>,
) {
  const changedAt = await historicalFollowUpOccurredAt(
    manager,
    patientId,
    followUpId,
  );
  await services.patients.upsertDetails(patientId, details, manager, {
    ...(changedAt ? { changedAt } : {}),
  });
}

async function persistTreatments(
  services: HistoricalClinicalServices,
  manager: EntityManager,
  patientId: string,
  followUpId: string,
  treatments: HistoricalFollowUpTreatmentDto[],
  createdDiagnoses: Map<string, PatientDiagnosis>,
) {
  for (const treatment of treatments) {
    const diagnosisId =
      treatment.diagnosisId ??
      (treatment.diagnosisRef
        ? createdDiagnoses.get(treatment.diagnosisRef)?.id
        : undefined);
    if (!diagnosisId)
      throw new BadRequestException(
        'Historical treatment requires diagnosisId or a valid diagnosisRef',
      );
    const treatmentValues = { ...treatment };
    delete treatmentValues.diagnosisRef;
    delete treatmentValues.diagnosisId;
    await services.treatments.create(
      patientId,
      {
        ...treatmentValues,
        followUpId,
        diagnosisId,
      },
      manager,
    );
  }
}

async function deleteWhereIn<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  column: string,
  ids: string[],
) {
  if (ids.length === 0) return;
  await manager
    .createQueryBuilder()
    .delete()
    .from(entity)
    .where(`${column} IN (:...ids)`, { ids })
    .execute();
}

export async function deleteHistoricalOwnedByFollowUp(
  manager: EntityManager,
  followUpId: string,
) {
  await manager.update(
    FollowUp,
    { nextFollowUpId: followUpId },
    { nextFollowUpId: null },
  );
  await manager.update(
    Reminder,
    { createdFromFollowUpId: followUpId },
    { createdFromFollowUpId: null },
  );
  await manager.update(
    Reminder,
    { resultingFollowUpId: followUpId },
    { resultingFollowUpId: null },
  );
  await manager.update(
    PsychooncologyAppointment,
    { followUpId },
    { followUpId: null },
  );
  await manager.update(
    PatientDiagnosticStatusEvent,
    { followUpId },
    { followUpId: null },
  );
  await manager.update(PatientAddress, { followUpId }, { followUpId: null });
  await manager.update(
    TreatmentMedication,
    { followUpId },
    { followUpId: null },
  );

  const appointments = await manager.find(PatientMedicalAppointment, {
    where: { followUpId },
    select: { id: true },
  });
  const appointmentIds = appointments.map((item) => item.id);
  if (appointmentIds.length > 0) {
    await manager
      .createQueryBuilder()
      .update(Reminder)
      .set({ medicalAppointmentId: null })
      .where('medical_appointment_id IN (:...ids)', { ids: appointmentIds })
      .execute();
    await manager.update(
      PatientMedicalAppointment,
      { followUpId },
      { reminderId: null },
    );
    await manager.delete(PatientMedicalAppointment, { followUpId });
  }

  const alerts = await manager.find(Alert, {
    where: { followUpId },
    select: { id: true },
  });
  await deleteWhereIn(
    manager,
    AlertEvent,
    'alert_id',
    alerts.map((item) => item.id),
  );
  await manager.delete(Alert, { followUpId });

  const assessments = await manager.find(PatientHealthBackgroundAssessment, {
    where: { followUpId },
    select: { id: true },
  });
  const assessmentIds = assessments.map((item) => item.id);
  await deleteWhereIn(
    manager,
    PatientActiveComorbidity,
    'assessment_id',
    assessmentIds,
  );
  await deleteWhereIn(
    manager,
    PatientLimitation,
    'assessment_id',
    assessmentIds,
  );
  await deleteWhereIn(
    manager,
    PatientFamilyCancerHistory,
    'assessment_id',
    assessmentIds,
  );
  await manager.delete(PatientHealthBackgroundAssessment, { followUpId });

  const treatments = await manager.find(PatientTreatment, {
    where: { followUpId },
    select: { id: true },
  });
  await deleteWhereIn(
    manager,
    TreatmentMedication,
    'treatment_id',
    treatments.map((item) => item.id),
  );
  await manager.delete(PatientTreatment, { followUpId });

  const diagnoses = await manager.find(PatientDiagnosis, {
    where: { followUpId },
    select: { id: true },
  });
  const diagnosisIds = diagnoses.map((item) => item.id);
  if (diagnosisIds.length > 0) {
    const linkedTreatments = await manager
      .createQueryBuilder(PatientTreatment, 'treatment')
      .where('treatment.diagnosis_id IN (:...ids)', { ids: diagnosisIds })
      .getCount();
    if (linkedTreatments > 0)
      throw new BadRequestException(
        'No se puede eliminar el seguimiento porque otros tratamientos dependen de sus diagnósticos',
      );
    await manager
      .createQueryBuilder()
      .update(PatientDiagnosticStatusEvent)
      .set({ diagnosisId: null })
      .where('diagnosis_id IN (:...ids)', { ids: diagnosisIds })
      .execute();
  }

  await manager.delete(PatientDiagnosis, { followUpId });
  await manager.delete(PatientInsurance, { followUpId });
  await manager.delete(PatientSisAffiliation, { followUpId });
  await manager.delete(PatientSymptomReport, { followUpId });
  await manager.delete(PatientSocialNote, { followUpId });
  await manager.delete(PatientPsychooncologySupportAssessment, { followUpId });
  await manager.delete(PatientNonOncologicalFollowUp, { followUpId });
}
