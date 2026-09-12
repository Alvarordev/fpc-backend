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

    if (input.hasMedicalConsultation === false) {
      normalized.noMedicalConsultationReason =
        input.noMedicalConsultationReason?.trim();
      if (!normalized.noMedicalConsultationReason)
        throw new BadRequestException(
          'noMedicalConsultationReason is required when no consultation was made',
        );
      normalized.firstConsultationDate = undefined;
      normalized.isAwaitingDiagnosis = undefined;
      normalized.hasReferral = undefined;
      normalized.referredHealthCenterId = undefined;
      normalized.referralNotProvidedReason = undefined;
      normalized.nextConsultationDate = undefined;
      normalized.hasReceivedDiagnosis = undefined;
      normalized.reportedDiagnosis = undefined;
    } else if (input.hasMedicalConsultation === true) {
      normalized.noMedicalConsultationReason = undefined;
      if (!input.healthCenterId || !present(input.specialty))
        throw new BadRequestException(
          'healthCenterId and specialty are required when a consultation was made',
        );
      if (!input.firstConsultationDate)
        throw new BadRequestException(
          'firstConsultationDate is required when a consultation was made',
        );
      if (typeof input.isAwaitingDiagnosis !== 'boolean')
        throw new BadRequestException(
          'isAwaitingDiagnosis is required when a consultation was made',
        );
      if (input.hasReferral === undefined)
        throw new BadRequestException(
          'hasReferral is required when a consultation was made',
        );
      if (input.hasReferral === true && !input.referredHealthCenterId)
        throw new BadRequestException(
          'referredHealthCenterId is required when a referral exists',
        );
      if (
        input.hasReferral === false &&
        !present(input.referralNotProvidedReason)
      )
        throw new BadRequestException(
          'referralNotProvidedReason is required when there is no referral',
        );
      if (input.hasReferral !== true)
        normalized.referredHealthCenterId = undefined;
      if (input.hasReferral !== false)
        normalized.referralNotProvidedReason = undefined;
      if (typeof input.hasReceivedDiagnosis !== 'boolean')
        throw new BadRequestException(
          'hasReceivedDiagnosis is required when a consultation was made',
        );
    } else if (
      (input.hasReferral !== undefined && input.hasReferral !== null) ||
      (input.firstConsultationDate !== undefined &&
        input.firstConsultationDate !== null) ||
      (input.isAwaitingDiagnosis !== undefined &&
        input.isAwaitingDiagnosis !== null)
    ) {
      throw new BadRequestException(
        'hasMedicalConsultation is required with the consultation details',
      );
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
