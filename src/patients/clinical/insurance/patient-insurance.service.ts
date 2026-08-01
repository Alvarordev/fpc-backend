import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { PatientRole } from '../../entities/patient-role.enum';
import { PatientInsurance } from '../../entities/patient-insurance.entity';
import { HistoryVersioningService } from '../../history-versioning/history-versioning.service';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientInsuranceDto } from './patient-insurance.dto';

@Injectable()
export class PatientInsuranceService {
  constructor(
    @InjectRepository(PatientInsurance)
    private readonly repository: Repository<PatientInsurance>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    private readonly patients: PatientsService,
    private readonly versioning: HistoryVersioningService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}
  async create(
    patientId: string,
    input: CreatePatientInsuranceDto,
    manager?: EntityManager,
  ) {
    await this.assertReferences(patientId, input.followUpId, manager);
    const insurance = await (manager
      ? this.versioning.replaceCurrent(
          PatientInsurance,
          { patientId, isCurrent: true },
          { ...input, patientId },
          manager,
        )
      : this.versioning.replaceCurrent(
          PatientInsurance,
          { patientId, isCurrent: true },
          { ...input, patientId },
        ));
    await this.invalidations.markDirty(patientId, manager);
    return insurance;
  }
  findAll(patientId: string) {
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
  private async assertReferences(
    patientId: string,
    followUpId: string,
    manager?: EntityManager,
  ) {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    if (
      !(await (manager?.getRepository(FollowUp) ?? this.followUps).existsBy({
        id: followUpId,
        subjectPatientId: patientId,
      }))
    )
      throw new NotFoundException('Follow-up not found');
  }
}
