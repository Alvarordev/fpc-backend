import { ConflictException } from '@nestjs/common';
import { EntityManager, EntityTarget, In, ObjectLiteral } from 'typeorm';
import { Alert } from '../../database/entities/alert.entity';
import { AlertEvent } from '../../database/entities/alert-event.entity';
import { CatalogItem } from '../../database/entities/catalog-item.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { PatientActivityEvent } from '../../database/entities/patient-activity-event.entity';
import { PatientAddress } from '../../database/entities/patient-address.entity';
import { PatientDiagnosis } from '../../database/entities/patient-diagnosis.entity';
import { PatientDiagnosticStatusEvent } from '../../database/entities/patient-diagnostic-status-event.entity';
import {
  PatientActiveComorbidity,
  PatientFamilyCancerHistory,
  PatientHealthBackgroundAssessment,
  PatientLimitation,
} from '../../database/entities/patient-health-background-assessment.entity';
import { PatientInsurance } from '../../database/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../../database/entities/patient-medical-appointment.entity';
import { PatientNonOncologicalFollowUp } from '../../database/entities/patient-non-oncological-follow-up.entity';
import { PatientPsychooncologySupportAssessment } from '../../database/entities/patient-psychooncology-support-assessment.entity';
import { PatientSisAffiliation } from '../../database/entities/patient-sis-affiliation.entity';
import { PatientSocialNote } from '../../database/entities/patient-social-note.entity';
import {
  PatientSocialReferral,
  SocialReferralStatus,
} from '../../database/entities/patient-social-referral.entity';
import { PatientSocialReferralUpdate } from '../../database/entities/patient-social-referral-update.entity';
import { PatientSymptomReport } from '../../database/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../../database/entities/patient-treatment.entity';
import { PsychooncologyAppointment } from '../../database/entities/psychooncology-appointment.entity';
import { Reminder } from '../../database/entities/reminder.entity';
import { TreatmentMedication } from '../../database/entities/treatment-medication.entity';
import { dateOnlyInLima } from '../../shared/date-only/date-only.util';
import { SOCIAL_REFERRAL_OUTCOME_KIND } from '../patients/social-referrals/patient-social-referrals.service';

/*
 * Hard deletes of clinical records. Every row removed here goes through the
 * audit triggers, so change_log keeps a DELETE entry with the full old row.
 */

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

async function nullifyWhereIn<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  property: keyof T & string,
  column: string,
  ids: string[],
) {
  if (ids.length === 0) return;
  await manager
    .createQueryBuilder()
    .update(entity)
    .set({ [property]: null } as never)
    .where(`${column} IN (:...ids)`, { ids })
    .execute();
}

/**
 * Documents (and their files) stay in the patient file. A medical report
 * needs a diagnosis and a prescription a treatment, so they become OTHER
 * documents whose description says what they were.
 */
async function detachDocuments(
  manager: EntityManager,
  ids: { diagnosisIds?: string[]; treatmentIds?: string[] },
) {
  const detach = async (column: string, ids: string[], label: string) => {
    if (ids.length === 0) return;
    await manager.query(
      `UPDATE patient_documents
          SET ${column} = NULL,
              document_type = 'OTHER',
              description = COALESCE(NULLIF(btrim(description), ''), $2)
        WHERE ${column} = ANY($1::uuid[])`,
      [ids, label],
    );
  };
  await detach(
    'treatment_id',
    ids.treatmentIds ?? [],
    'Receta de un tratamiento eliminado',
  );
  await detach(
    'diagnosis_id',
    ids.diagnosisIds ?? [],
    'Informe médico de un diagnóstico eliminado',
  );
}

/**
 * Deletes treatments (and their medications). When a deleted treatment was
 * the current version of its series, the latest remaining version takes over.
 */
export async function deleteTreatments(
  manager: EntityManager,
  treatmentIds: string[],
) {
  if (treatmentIds.length === 0) return;
  const current = await manager.find(PatientTreatment, {
    where: { id: In(treatmentIds), isCurrent: true },
    select: { seriesId: true },
  });
  await detachDocuments(manager, { treatmentIds });
  await deleteWhereIn(
    manager,
    TreatmentMedication,
    'treatment_id',
    treatmentIds,
  );
  await deleteWhereIn(manager, PatientTreatment, 'id', treatmentIds);
  await restorePreviousVersions(manager, {
    insurancePatients: [],
    treatmentSeries: [...new Set(current.map((item) => item.seriesId))],
    appointments: [],
  });
}

/**
 * Deletes diagnoses. Treatments that depend on them must be deleted first
 * (deleteTreatments); status events and documents only lose the link.
 */
export async function deleteDiagnoses(
  manager: EntityManager,
  diagnosisIds: string[],
) {
  if (diagnosisIds.length === 0) return;
  await nullifyWhereIn(
    manager,
    PatientDiagnosticStatusEvent,
    'diagnosisId',
    'diagnosis_id',
    diagnosisIds,
  );
  await detachDocuments(manager, { diagnosisIds });
  await deleteWhereIn(manager, PatientDiagnosis, 'id', diagnosisIds);
}

/**
 * Removes everything recorded in a follow-up so the follow-up row itself can
 * be deleted. Records from other follow-ups that only point at it keep their
 * data and lose the link.
 */
export async function deleteRecordsOwnedByFollowUp(
  manager: EntityManager,
  followUpId: string,
) {
  // Versiones vigentes que se van a borrar: al quitarlas, la versión anterior
  // de su grupo vuelve a ser la vigente (p. ej. SIS tras borrar el cambio a EsSalud).
  const replacedCurrent = await currentVersionsOwnedBy(manager, followUpId);
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
    PsychooncologyAppointment,
    { followUpId },
    { followUpId: null },
  );
  await manager.update(
    PatientDiagnosticStatusEvent,
    { followUpId },
    { followUpId: null },
  );
  // Un cambio de estado (inactivo, fallecido) sigue siendo cierto aunque se
  // borre el seguimiento donde se registró.
  await manager.update(
    PatientActivityEvent,
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
    await nullifyWhereIn(
      manager,
      Reminder,
      'medicalAppointmentId',
      'medical_appointment_id',
      appointmentIds,
    );
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
  const treatmentIds = treatments.map((item) => item.id);
  await detachDocuments(manager, { treatmentIds });
  await deleteWhereIn(
    manager,
    TreatmentMedication,
    'treatment_id',
    treatmentIds,
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
      throw new ConflictException(
        'No se puede eliminar el seguimiento porque tratamientos de otros seguimientos dependen de sus diagnósticos. Elimina primero esos tratamientos.',
      );
    await deleteDiagnoses(manager, diagnosisIds);
  }

  await deleteSocialReferralsOf(manager, followUpId);

  await manager.delete(PatientInsurance, { followUpId });
  await manager.delete(PatientSisAffiliation, { followUpId });
  await manager.delete(PatientSymptomReport, { followUpId });
  await manager.delete(PatientSocialNote, { followUpId });
  await manager.delete(PatientPsychooncologySupportAssessment, { followUpId });
  await manager.delete(PatientNonOncologicalFollowUp, { followUpId });
  await restorePreviousVersions(manager, replacedCurrent);
}

/**
 * Deletes the referrals opened and the outcomes recorded in a follow-up. A
 * referral from another follow-up that lost an outcome takes its state from
 * the latest outcome left, as when the outcome was recorded.
 */
async function deleteSocialReferralsOf(
  manager: EntityManager,
  followUpId: string,
) {
  const updates = await manager.find(PatientSocialReferralUpdate, {
    where: { followUpId },
    select: { referralId: true },
  });
  // Las actualizaciones de estas derivaciones se borran en cascada.
  await manager.delete(PatientSocialReferral, { followUpId });
  await manager.delete(PatientSocialReferralUpdate, { followUpId });

  const touchedIds = [...new Set(updates.map((item) => item.referralId))];
  if (touchedIds.length === 0) return;
  const referrals = await manager.find(PatientSocialReferral, {
    where: { id: In(touchedIds) },
  });
  for (const referral of referrals) {
    const latest = await manager.findOne(PatientSocialReferralUpdate, {
      where: { referralId: referral.id },
      order: { createdAt: 'DESC' },
    });
    let closes = false;
    if (latest) {
      const item = await manager.findOneBy(CatalogItem, {
        kind: SOCIAL_REFERRAL_OUTCOME_KIND[referral.type],
        code: latest.outcome,
      });
      closes = item?.metadata?.closesReferral !== false;
    }
    await manager.update(
      PatientSocialReferral,
      { id: referral.id },
      {
        status: closes
          ? SocialReferralStatus.CLOSED
          : SocialReferralStatus.OPEN,
        closedAt: closes && latest ? dateOnlyInLima(latest.createdAt) : null,
      },
    );
  }
}

type VersionGroups = {
  insurancePatients: string[];
  treatmentSeries: string[];
  appointments: { patientId: string; specialty: string }[];
};

async function currentVersionsOwnedBy(
  manager: EntityManager,
  followUpId: string,
): Promise<VersionGroups> {
  const [insurance, treatments, appointments] = await Promise.all([
    manager.find(PatientInsurance, {
      where: { followUpId, isCurrent: true },
      select: { patientId: true },
    }),
    manager.find(PatientTreatment, {
      where: { followUpId, isCurrent: true },
      select: { seriesId: true },
    }),
    manager.find(PatientMedicalAppointment, {
      where: { followUpId, isCurrent: true },
      select: { patientId: true, specialty: true },
    }),
  ]);
  return {
    insurancePatients: insurance.map((item) => item.patientId),
    treatmentSeries: treatments.map((item) => item.seriesId),
    appointments: appointments.map((item) => ({
      patientId: item.patientId,
      specialty: item.specialty,
    })),
  };
}

/** Marca como vigente la versión más reciente que quedó en cada grupo, si no hay otra vigente. */
async function restorePreviousVersions(
  manager: EntityManager,
  groups: VersionGroups,
) {
  for (const patientId of groups.insurancePatients)
    await manager.query(
      `UPDATE patient_insurance SET is_current = true, end_date = NULL
        WHERE id = (SELECT id FROM patient_insurance WHERE patient_id = $1
                     ORDER BY start_date DESC NULLS LAST, created_at DESC LIMIT 1)
          AND NOT EXISTS (SELECT 1 FROM patient_insurance
                           WHERE patient_id = $1 AND is_current)`,
      [patientId],
    );
  for (const seriesId of groups.treatmentSeries)
    await manager.query(
      `UPDATE patient_treatments SET is_current = true
        WHERE id = (SELECT id FROM patient_treatments WHERE series_id = $1
                     ORDER BY created_at DESC LIMIT 1)
          AND NOT EXISTS (SELECT 1 FROM patient_treatments
                           WHERE series_id = $1 AND is_current)`,
      [seriesId],
    );
  for (const { patientId, specialty } of groups.appointments)
    await manager.query(
      `UPDATE patient_medical_appointments SET is_current = true
        WHERE id = (SELECT id FROM patient_medical_appointments
                     WHERE patient_id = $1 AND specialty = $2
                     ORDER BY created_at DESC LIMIT 1)
          AND NOT EXISTS (SELECT 1 FROM patient_medical_appointments
                           WHERE patient_id = $1 AND specialty = $2 AND is_current)`,
      [patientId, specialty],
    );
}
