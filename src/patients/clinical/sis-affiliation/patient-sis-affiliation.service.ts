import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Interaction } from '../../../database/entities/interaction.entity';
import { PatientRole } from '../../entities/patient-role.enum';
import { PatientSisAffiliation } from '../../entities/patient-sis-affiliation.entity';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientSisAffiliationDto } from './patient-sis-affiliation.dto';
@Injectable()
export class PatientSisAffiliationService {
  constructor(
    @InjectRepository(PatientSisAffiliation)
    private readonly repository: Repository<PatientSisAffiliation>,
    @InjectRepository(Interaction)
    private readonly interactions: Repository<Interaction>,
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
      !(await (
        manager?.getRepository(Interaction) ?? this.interactions
      ).existsBy({ id: input.interactionId }))
    )
      throw new NotFoundException('Interaction not found');
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
  findAll(patientId: string) {
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
