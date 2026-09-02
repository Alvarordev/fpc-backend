import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PatientAddress } from '../../database/entities/patient-address.entity';
import { PatientDiagnosis } from '../../database/entities/patient-diagnosis.entity';
import { PatientInsurance } from '../../database/entities/patient-insurance.entity';
import { PatientSisAffiliation } from '../../database/entities/patient-sis-affiliation.entity';
import { PatientSocialNote } from '../../database/entities/patient-social-note.entity';
import { PatientSymptomReport } from '../../database/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../../database/entities/patient-treatment.entity';
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
    await services.patients.upsertDetails(patientId, input.details, manager);

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
    await services.patients.upsertDetails(patientId, input.details, manager);

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
      const {
        mode: _mode,
        replacementDiagnosisId: _replacement,
        ...updatable
      } = values;
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
      await repository.save(Object.assign(existing, values));
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
