import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Enrollment } from '../../database/entities/enrollment.entity';
import { Interaction } from '../../database/entities/interaction.entity';
import { PatientRole } from '../entities/patient-role.enum';
import { PatientSymptomReport } from '../entities/patient-symptom-report.entity';
import { PatientsService } from '../patients.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientSymptomReportDto } from './patient-symptom-reports.dto';

@Injectable()
export class PatientSymptomReportsService {
  constructor(
    @InjectRepository(PatientSymptomReport)
    private readonly repository: Repository<PatientSymptomReport>,
    @InjectRepository(Interaction)
    private readonly interactions: Repository<Interaction>,
    @InjectRepository(Enrollment)
    private readonly enrollments: Repository<Enrollment>,
    private readonly patients: PatientsService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

  async create(
    patientId: string,
    input: CreatePatientSymptomReportDto,
    manager?: EntityManager,
  ) {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    const interactions =
      manager?.getRepository(Interaction) ?? this.interactions;
    if (!(await interactions.existsBy({ id: input.interactionId })))
      throw new NotFoundException('Interaction not found');
    const enrollments = manager?.getRepository(Enrollment) ?? this.enrollments;
    if (
      input.enrollmentId &&
      !(await enrollments.existsBy({ id: input.enrollmentId, patientId }))
    )
      throw new NotFoundException('Enrollment not found');
    const repository =
      manager?.getRepository(PatientSymptomReport) ?? this.repository;
    const symptom = await repository.save(
      repository.create({ ...input, patientId }),
    );
    await this.invalidations.markDirty(patientId, manager);
    return symptom;
  }

  findAll(patientId: string) {
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
