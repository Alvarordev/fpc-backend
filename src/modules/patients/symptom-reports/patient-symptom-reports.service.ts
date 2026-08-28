import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Enrollment } from '../../../database/entities/enrollment.entity';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { PatientSymptomReport } from '../../../database/entities/patient-symptom-report.entity';
import { PatientsService } from '../patients.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientSymptomReportDto } from './dto/create-patient-symptom-report.dto';
import { User } from '../../../database/entities/user.entity';
import { normalizeDuration } from '../../../shared/duration/duration.util';
import { MedicalConsultationStatus } from '../../../database/entities/medical-consultation-status.enum';

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
    const normalized = this.validateAndNormalize(input);
    const symptom = await repository.save(
      repository.create({
        ...normalized,
        patientId,
        symptomDuration: normalizeDuration(normalized.symptomDuration),
        symptomFrequency: normalizeDuration(normalized.symptomFrequency),
        diagnosisSearchDuration: normalizeDuration(
          normalized.diagnosisSearchDuration,
        ),
        reportedTreatmentFrequency: normalizeDuration(
          normalized.reportedTreatmentFrequency,
        ),
      }),
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

  private validateAndNormalize(
    input: CreatePatientSymptomReportDto,
  ): CreatePatientSymptomReportDto {
    const normalized = { ...input };
    const present = (value: string | undefined) => Boolean(value?.trim());

    if (input.hasDiscomfort === false && !present(input.checkupMotivation))
      throw new BadRequestException(
        'checkupMotivation is required when the patient has no discomfort',
      );
    if (input.hasDiscomfort === true) normalized.checkupMotivation = undefined;

    if (input.hasRequestedMedicalConsultation === false) {
      normalized.consultationStatus = undefined;
      normalized.consultationNotObtainedReason = undefined;
      normalized.healthCenterId = undefined;
      normalized.specialty = undefined;
      normalized.indicationsReceived = undefined;
    } else if (input.hasRequestedMedicalConsultation === true) {
      if (!input.consultationStatus)
        throw new BadRequestException(
          'consultationStatus is required when a consultation was requested',
        );
      if (input.consultationStatus === MedicalConsultationStatus.NOT_OBTAINED) {
        if (!present(input.consultationNotObtainedReason))
          throw new BadRequestException(
            'consultationNotObtainedReason is required for NOT_OBTAINED',
          );
        normalized.healthCenterId = undefined;
        normalized.specialty = undefined;
        normalized.indicationsReceived = undefined;
      } else {
        if (!input.healthCenterId || !present(input.specialty))
          throw new BadRequestException(
            'healthCenterId and specialty are required for scheduled or attended consultations',
          );
        normalized.consultationNotObtainedReason = undefined;
      }
    }

    if (
      input.hasReceivedDiagnosis === true &&
      !present(input.reportedDiagnosis)
    )
      throw new BadRequestException(
        'reportedDiagnosis is required when a diagnosis was received',
      );
    if (input.hasReceivedDiagnosis === false)
      normalized.reportedDiagnosis = undefined;

    if (input.isReceivingReportedTreatment === true) {
      if (
        !present(input.reportedTreatment) ||
        !input.reportedTreatmentFrequency
      )
        throw new BadRequestException(
          'reportedTreatment and reportedTreatmentFrequency are required when treatment is being received',
        );
      normalized.notReceivingTreatmentReason = undefined;
    } else if (input.isReceivingReportedTreatment === false) {
      if (!present(input.notReceivingTreatmentReason))
        throw new BadRequestException(
          'notReceivingTreatmentReason is required when treatment is not being received',
        );
      normalized.reportedTreatment = undefined;
      normalized.reportedTreatmentFrequency = undefined;
    }

    return normalized;
  }
}
