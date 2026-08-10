import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { HealthCenter } from '../../../database/entities/health-center.entity';
import { PatientReferral } from '../../../database/entities/patient-referral.entity';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { PatientsService } from '../patients.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientReferralDto } from './dto/create-patient-referral.dto';
import { User } from '../../../database/entities/user.entity';

@Injectable()
export class PatientReferralsService {
  constructor(
    @InjectRepository(PatientReferral)
    private readonly repository: Repository<PatientReferral>,
    @InjectRepository(HealthCenter)
    private readonly healthCenters: Repository<HealthCenter>,
    private readonly patients: PatientsService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

  async create(
    patientId: string,
    input: CreatePatientReferralDto,
    manager?: EntityManager,
  ): Promise<PatientReferral> {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    const healthCenters =
      manager?.getRepository(HealthCenter) ?? this.healthCenters;
    if (!(await healthCenters.existsBy({ id: input.toHealthCenterId })))
      throw new NotFoundException('Destination health center not found');
    const repository =
      manager?.getRepository(PatientReferral) ?? this.repository;
    const referral = await repository.save(
      repository.create({ ...input, patientId }),
    );
    await this.invalidations.markDirty(patientId, manager);
    return referral;
  }

  async findAll(patientId: string, user: User): Promise<PatientReferral[]> {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      relations: { fromHealthCenter: true, toHealthCenter: true },
      order: { createdAt: 'DESC' },
    });
  }
}
