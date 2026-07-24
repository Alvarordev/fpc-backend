import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interaction } from '../database/entities/interaction.entity';
import { PatientRole } from '../database/entities/patient-role.enum';
import { PatientSisAffiliation } from '../database/entities/patient-sis-affiliation.entity';
import { PatientsService } from '../patients/patients.service';
import { CreatePatientSisAffiliationDto } from './patient-sis-affiliation.dto';
@Injectable()
export class PatientSisAffiliationService {
  constructor(
    @InjectRepository(PatientSisAffiliation)
    private readonly repository: Repository<PatientSisAffiliation>,
    @InjectRepository(Interaction)
    private readonly interactions: Repository<Interaction>,
    private readonly patients: PatientsService,
  ) {}
  async create(patientId: string, input: CreatePatientSisAffiliationDto) {
    await this.patients.assertPatientRole(patientId, PatientRole.PATIENT);
    if (!(await this.interactions.existsBy({ id: input.interactionId })))
      throw new NotFoundException('Interaction not found');
    return this.repository.save(
      this.repository.create({
        ...input,
        patientId,
        affiliatedAt: input.affiliatedAt ? new Date(input.affiliatedAt) : null,
      }),
    );
  }
  findAll(patientId: string) {
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
