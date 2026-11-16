import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Enrollment } from '../../database/entities/enrollment.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { FollowUpPurpose } from '../../database/entities/follow-up.enums';
import { PatientDiagnosis } from '../../database/entities/patient-diagnosis.entity';
import { PatientTreatment } from '../../database/entities/patient-treatment.entity';
import { PatientHealthSubcategoryService } from '../patients/health-subcategory/patient-health-subcategory.service';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import {
  deleteDiagnoses,
  deleteRecordsOwnedByFollowUp,
  deleteTreatments,
} from './record-cascade';

export interface DeleteDiagnosisOptions {
  /** Also deletes the treatments recorded under the diagnosis. */
  withTreatments?: boolean;
  /** A retired diagnosis of the same patient to make active again. */
  restoreDiagnosisId?: string;
}

/**
 * Administrative hard deletes of records entered by mistake. They replace
 * the SQL scripts run by hand: each one cleans up what depends on the record
 * and leaves a DELETE entry per row in change_log.
 */
@Injectable()
export class RecordDeletionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly subcategories: PatientHealthSubcategoryService,
  ) {}

  async deleteFollowUp(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const followUp = await manager.findOneBy(FollowUp, { id });
      if (!followUp)
        throw new NotFoundException('No se encontró el seguimiento.');
      if (
        followUp.purpose === FollowUpPurpose.ENROLLMENT ||
        (await manager.existsBy(Enrollment, { followUpId: id }))
      )
        throw new ConflictException(
          'No se puede eliminar el seguimiento de enrolamiento.',
        );

      await deleteRecordsOwnedByFollowUp(manager, id);
      await manager.delete(FollowUp, { id });
      await this.afterClinicalChange(followUp.subjectPatientId, manager);
    });
  }

  async deleteDiagnosis(
    patientId: string,
    diagnosisId: string,
    options: DeleteDiagnosisOptions = {},
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const diagnosis = await manager.findOneBy(PatientDiagnosis, {
        id: diagnosisId,
        patientId,
      });
      if (!diagnosis)
        throw new NotFoundException('No se encontró el diagnóstico.');

      const restore = options.restoreDiagnosisId
        ? await this.findDiagnosisToRestore(
            manager,
            patientId,
            diagnosisId,
            options.restoreDiagnosisId,
          )
        : null;

      const treatments = await manager.find(PatientTreatment, {
        where: { diagnosisId },
        select: { id: true },
      });
      if (treatments.length > 0 && !options.withTreatments)
        throw new ConflictException(
          `El diagnóstico tiene ${treatments.length} tratamiento(s) registrado(s). Elimínalos primero o repite la solicitud con withTreatments=true.`,
        );

      await deleteTreatments(
        manager,
        treatments.map((item) => item.id),
      );
      await deleteDiagnoses(manager, [diagnosisId]);
      if (restore)
        await manager.update(
          PatientDiagnosis,
          { id: restore.id },
          { isCurrent: true },
        );
      await this.afterClinicalChange(patientId, manager);
    });
  }

  async deleteTreatment(patientId: string, treatmentId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (
        !(await manager.existsBy(PatientTreatment, {
          id: treatmentId,
          patientId,
        }))
      )
        throw new NotFoundException('No se encontró el tratamiento.');
      await deleteTreatments(manager, [treatmentId]);
      await this.afterClinicalChange(patientId, manager);
    });
  }

  private async findDiagnosisToRestore(
    manager: EntityManager,
    patientId: string,
    deletedId: string,
    restoreId: string,
  ) {
    if (restoreId === deletedId)
      throw new BadRequestException(
        'El diagnóstico a reactivar no puede ser el que se elimina.',
      );
    const restore = await manager.findOne(PatientDiagnosis, {
      where: { id: restoreId, patientId },
      select: { id: true, isCurrent: true },
    });
    if (!restore)
      throw new NotFoundException('No se encontró el diagnóstico a reactivar.');
    if (restore.isCurrent)
      throw new ConflictException('El diagnóstico a reactivar ya está activo.');
    return restore;
  }

  /** Cached summaries and the derived subcategory depend on clinical data. */
  private async afterClinicalChange(patientId: string, manager: EntityManager) {
    await this.subcategories.syncFromTreatments(patientId, manager);
    await this.invalidations.markDirty(patientId, manager);
  }
}
