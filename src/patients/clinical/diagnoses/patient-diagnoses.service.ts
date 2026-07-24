import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Interaction } from '../../../database/entities/interaction.entity';
import { PatientDiagnosis } from '../../entities/patient-diagnosis.entity';
import { PatientRole } from '../../entities/patient-role.enum';
import { HistoryVersioningService } from '../../history-versioning/history-versioning.service';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientDiagnosisDto } from './patient-diagnoses.dto';
@Injectable()
export class PatientDiagnosesService {
  constructor(
    @InjectRepository(PatientDiagnosis)
    private readonly repository: Repository<PatientDiagnosis>,
    @InjectRepository(Interaction)
    private readonly interactions: Repository<Interaction>,
    private readonly patients: PatientsService,
    private readonly versioning: HistoryVersioningService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}
  async create(
    patientId: string,
    input: CreatePatientDiagnosisDto,
    manager?: EntityManager,
  ) {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    if (
      !(await (
        manager?.getRepository(Interaction) ?? this.interactions
      ).existsBy({ id: input.interactionId }))
    )
      throw new NotFoundException('Interaction not found');
    const diagnosis = await (manager
      ? this.versioning.replaceCurrent(
          PatientDiagnosis,
          { patientId, isCurrent: true },
          { ...input, patientId },
          manager,
        )
      : this.versioning.replaceCurrent(
          PatientDiagnosis,
          { patientId, isCurrent: true },
          { ...input, patientId },
        ));
    await this.invalidations.markDirty(patientId, manager);
    return diagnosis;
  }
  findAll(patientId: string) {
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
