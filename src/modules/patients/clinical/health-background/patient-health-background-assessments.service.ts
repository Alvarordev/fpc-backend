import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import {
  PatientActiveComorbidity,
  PatientFamilyCancerHistory,
  PatientHealthBackgroundAssessment,
  PatientLimitation,
} from '../../../../database/entities/patient-health-background-assessment.entity';
import { PatientRole } from '../../../../database/entities/patient-role.enum';
import { User } from '../../../../database/entities/user.entity';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { PatientsService } from '../../patients.service';
import { CreatePatientHealthBackgroundAssessmentDto } from './dto/create-patient-health-background-assessment.dto';

@Injectable()
export class PatientHealthBackgroundAssessmentsService {
  constructor(
    @InjectRepository(PatientHealthBackgroundAssessment)
    private readonly assessments: Repository<PatientHealthBackgroundAssessment>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    private readonly patients: PatientsService,
    private readonly dataSource: DataSource,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

  async create(
    patientId: string,
    input: CreatePatientHealthBackgroundAssessmentDto,
    manager?: EntityManager,
  ): Promise<PatientHealthBackgroundAssessment> {
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

    const assessmentRepository = manager.getRepository(
      PatientHealthBackgroundAssessment,
    );
    const assessment = await assessmentRepository.save(
      assessmentRepository.create({
        patientId,
        followUpId: input.followUpId,
        hasPsychiatry: input.hasPsychiatry ?? null,
      }),
    );
    const activeComorbidities = input.activeComorbidities?.length
      ? await manager.getRepository(PatientActiveComorbidity).save(
          input.activeComorbidities.map((item) =>
            manager.getRepository(PatientActiveComorbidity).create({
              ...item,
              assessmentId: assessment.id,
            }),
          ),
        )
      : [];
    const limitations = input.limitations?.length
      ? await manager.getRepository(PatientLimitation).save(
          input.limitations.map((item) =>
            manager.getRepository(PatientLimitation).create({
              ...item,
              assessmentId: assessment.id,
            }),
          ),
        )
      : [];
    const familyCancerHistory = input.familyCancerHistory?.length
      ? await manager.getRepository(PatientFamilyCancerHistory).save(
          input.familyCancerHistory.map((item) =>
            manager.getRepository(PatientFamilyCancerHistory).create({
              ...item,
              assessmentId: assessment.id,
            }),
          ),
        )
      : [];
    await this.invalidations.markDirty(patientId, manager);
    return Object.assign(assessment, {
      activeComorbidities,
      limitations,
      familyCancerHistory,
    });
  }

  async findAll(
    patientId: string,
    user: User,
  ): Promise<PatientHealthBackgroundAssessment[]> {
    await this.patients.assertCanRead(patientId, user);
    return this.assessments.find({
      where: { patientId },
      relations: {
        activeComorbidities: true,
        limitations: true,
        familyCancerHistory: true,
      },
      order: { createdAt: 'DESC' },
    });
  }
}
