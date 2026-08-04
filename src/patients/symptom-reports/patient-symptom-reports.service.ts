import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Enrollment } from '../../database/entities/enrollment.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { PatientRole } from '../entities/patient-role.enum';
import { PatientSymptomReport } from '../entities/patient-symptom-report.entity';
import { PatientsService } from '../patients.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientSymptomReportDto } from './patient-symptom-reports.dto';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class PatientSymptomReportsService {
  constructor(
    @InjectRepository(PatientSymptomReport)
    private readonly repository: Repository<PatientSymptomReport>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
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
    const followUps = manager?.getRepository(FollowUp) ?? this.followUps;
    if (
      !(await followUps.existsBy({
        id: input.followUpId,
        subjectPatientId: patientId,
      }))
    )
      throw new NotFoundException('Follow-up not found');
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

  async findAll(patientId: string, user: User) {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
