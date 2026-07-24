import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Interaction } from '../../../database/entities/interaction.entity';
import { PatientDiagnosis } from '../../entities/patient-diagnosis.entity';
import { PatientRole } from '../../entities/patient-role.enum';
import { PatientTreatment } from '../../entities/patient-treatment.entity';
import { HistoryVersioningService } from '../../history-versioning/history-versioning.service';
import { PatientsService } from '../../patients.service';
import { CreatePatientTreatmentDto } from './patient-treatments.dto';
@Injectable()
export class PatientTreatmentsService {
  constructor(
    @InjectRepository(PatientTreatment)
    private readonly repository: Repository<PatientTreatment>,
    @InjectRepository(PatientDiagnosis)
    private readonly diagnoses: Repository<PatientDiagnosis>,
    @InjectRepository(Interaction)
    private readonly interactions: Repository<Interaction>,
    private readonly patients: PatientsService,
    private readonly versioning: HistoryVersioningService,
  ) {}
  async create(
    patientId: string,
    input: CreatePatientTreatmentDto,
    manager?: EntityManager,
  ) {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    const diagnoses =
      manager?.getRepository(PatientDiagnosis) ?? this.diagnoses;
    const interactions =
      manager?.getRepository(Interaction) ?? this.interactions;
    const [diagnosis, interaction] = await Promise.all([
      diagnoses.findOne({ where: { id: input.diagnosisId } }),
      interactions.existsBy({ id: input.interactionId }),
    ]);
    if (!diagnosis) throw new NotFoundException('Diagnosis not found');
    if (diagnosis.patientId !== patientId)
      throw new ConflictException('Diagnosis does not belong to patient');
    if (!interaction) throw new NotFoundException('Interaction not found');
    return manager
      ? this.versioning.replaceCurrent(
          PatientTreatment,
          { diagnosisId: input.diagnosisId, isCurrent: true },
          { ...input, patientId },
          manager,
        )
      : this.versioning.replaceCurrent(
          PatientTreatment,
          { diagnosisId: input.diagnosisId, isCurrent: true },
          { ...input, patientId },
        );
  }
  findAll(patientId: string) {
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
