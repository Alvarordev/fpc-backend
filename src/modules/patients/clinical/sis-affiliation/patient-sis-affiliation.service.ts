import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { PatientRole } from '../../../../database/entities/patient-role.enum';
import { PatientSisAffiliation } from '../../../../database/entities/patient-sis-affiliation.entity';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientSisAffiliationDto } from './dto/create-patient-sis-affiliation.dto';
import { User } from '../../../../database/entities/user.entity';
@Injectable()
export class PatientSisAffiliationService {
  constructor(
    @InjectRepository(PatientSisAffiliation)
    private readonly repository: Repository<PatientSisAffiliation>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    private readonly patients: PatientsService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}
  async create(
    patientId: string,
    input: CreatePatientSisAffiliationDto,
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
        id: input.followUpId,
        subjectPatientId: patientId,
      }))
    )
      throw new NotFoundException('Follow-up not found');
    const repository =
      manager?.getRepository(PatientSisAffiliation) ?? this.repository;
    const affiliation = await repository.save(
      repository.create({
        ...input,
        patientId,
        affiliatedAt: input.affiliatedAt ? new Date(input.affiliatedAt) : null,
      }),
    );
    await this.invalidations.markDirty(patientId, manager);
    return affiliation;
  }
  async findAll(patientId: string, user: User) {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
