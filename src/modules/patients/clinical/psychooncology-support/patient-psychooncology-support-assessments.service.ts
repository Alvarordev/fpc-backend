import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { PatientPsychooncologySupportAssessment } from '../../../../database/entities/patient-psychooncology-support-assessment.entity';
import { PatientRole } from '../../../../database/entities/patient-role.enum';
import { User } from '../../../../database/entities/user.entity';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { PatientsService } from '../../patients.service';
import { CreatePatientPsychooncologySupportAssessmentDto } from './dto/create-patient-psychooncology-support-assessment.dto';

@Injectable()
export class PatientPsychooncologySupportAssessmentsService {
  constructor(
    @InjectRepository(PatientPsychooncologySupportAssessment)
    private readonly assessments: Repository<PatientPsychooncologySupportAssessment>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    private readonly patients: PatientsService,
    private readonly dataSource: DataSource,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

  async create(
    patientId: string,
    input: CreatePatientPsychooncologySupportAssessmentDto,
    manager?: EntityManager,
  ): Promise<PatientPsychooncologySupportAssessment> {
    if (!manager)
      return this.dataSource.transaction((transactionManager) =>
        this.create(patientId, input, transactionManager),
      );

    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    if (
      !(await manager.getRepository(FollowUp).existsBy({
        id: input.followUpId,
        subjectPatientId: patientId,
      }))
    )
      throw new NotFoundException('Follow-up not found');

    const repository = manager.getRepository(
      PatientPsychooncologySupportAssessment,
    );
    const assessment = await repository.save(
      repository.create({
        patientId,
        followUpId: input.followUpId,
        excessiveWorry: input.excessiveWorry ?? null,
        emotionalDistressScore: input.emotionalDistressScore ?? null,
        preferredModality: input.preferredModality ?? null,
      }),
    );
    await this.invalidations.markDirty(patientId, manager);
    return assessment;
  }

  async findAll(
    patientId: string,
    user: User,
  ): Promise<PatientPsychooncologySupportAssessment[]> {
    await this.patients.assertCanRead(patientId, user);
    return this.assessments.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
