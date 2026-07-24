import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interaction } from '../database/entities/interaction.entity';
import { PatientRole } from '../database/entities/patient-role.enum';
import { PatientInsurance } from '../database/entities/patient-insurance.entity';
import { HistoryVersioningService } from '../history-versioning/history-versioning.service';
import { PatientsService } from '../patients/patients.service';
import { CreatePatientInsuranceDto } from './patient-insurance.dto';

@Injectable()
export class PatientInsuranceService {
  constructor(
    @InjectRepository(PatientInsurance)
    private readonly repository: Repository<PatientInsurance>,
    @InjectRepository(Interaction)
    private readonly interactions: Repository<Interaction>,
    private readonly patients: PatientsService,
    private readonly versioning: HistoryVersioningService,
  ) {}
  async create(patientId: string, input: CreatePatientInsuranceDto) {
    await this.assertReferences(patientId, input.interactionId);
    return this.versioning.replaceCurrent(
      PatientInsurance,
      { patientId, isCurrent: true },
      { ...input, patientId },
    );
  }
  findAll(patientId: string) {
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
  private async assertReferences(patientId: string, interactionId: string) {
    await this.patients.assertPatientRole(patientId, PatientRole.PATIENT);
    if (!(await this.interactions.existsBy({ id: interactionId })))
      throw new NotFoundException('Interaction not found');
  }
}
