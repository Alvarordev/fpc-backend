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
import { ClinicalOwnershipService } from '../clinical-ownership.service';

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
    private readonly ownership: ClinicalOwnershipService,
  ) {}

  async create(
    patientId: string,
    input: CreatePatientSymptomReportDto,
    manager?: EntityManager,
    options: { skipAppointmentFanOut?: boolean; historical?: boolean } = {},
  ): Promise<PatientSymptomReport> {
    if (!manager) {
      return this.repository.manager.transaction((transactionManager) =>
        this.create(patientId, input, transactionManager, options),
      );
    }
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
      throw new NotFoundException('No se encontró el seguimiento.');
    const enrollments = manager?.getRepository(Enrollment) ?? this.enrollments;
    if (
      input.enrollmentId &&
      !(await enrollments.existsBy({ id: input.enrollmentId, patientId }))
    )
      throw new NotFoundException('No se encontró el enrolamiento.');
    const repository =
      manager?.getRepository(PatientSymptomReport) ?? this.repository;
    const normalized = this.validateAndNormalize(input);
    await this.ownership.fanOutFromSymptomReport(
      patientId,
      input.followUpId,
      input.enrollmentId ?? null,
      normalized,
      manager,
      { skipAppointment: options.skipAppointmentFanOut, historical: options.historical },
    );
    const persistable = this.ownership.stripOwnershipFields(normalized);
    const symptom = await repository.save(
      repository.create({
        ...persistable,
        patientId,
        symptomDuration: normalizeDuration(persistable.symptomDuration),
        symptomFrequency: normalizeDuration(persistable.symptomFrequency),
        diagnosisSearchDuration: normalizeDuration(
          persistable.diagnosisSearchDuration,
        ),
        reportedTreatmentFrequency: normalizeDuration(null),
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
        'Si el paciente no tiene molestias, indica el motivo del chequeo.',
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
          'Indica el estado de la consulta.',
        );
      if (input.consultationStatus === MedicalConsultationStatus.NOT_OBTAINED) {
        if (!present(input.consultationNotObtainedReason))
          throw new BadRequestException(
            'Indica por qué no se obtuvo la consulta.',
          );
        normalized.healthCenterId = undefined;
        normalized.specialty = undefined;
        normalized.indicationsReceived = undefined;
      } else {
        if (!input.healthCenterId || !present(input.specialty))
          throw new BadRequestException(
            'Selecciona el establecimiento y la especialidad de la consulta.',
          );
        normalized.consultationNotObtainedReason = undefined;
      }
    }

    if (input.hasMedicalConsultation === false) {
      normalized.noMedicalConsultationReason =
        input.noMedicalConsultationReason?.trim();
      if (!normalized.noMedicalConsultationReason)
        throw new BadRequestException(
          'Indica por qué no tuvo consulta médica.',
        );
      normalized.firstConsultationDate = undefined;
      normalized.isAwaitingDiagnosis = undefined;
      normalized.hasReferral = undefined;
      normalized.referredHealthCenterId = undefined;
      normalized.referralNotProvidedReason = undefined;
      normalized.nextConsultationDate = undefined;
      normalized.nextConsultationSpecialty = undefined;
      normalized.nextConsultationNote = undefined;
      normalized.hasReceivedDiagnosis = undefined;
      normalized.reportedDiagnosis = undefined;
    } else if (input.hasMedicalConsultation === true) {
      normalized.noMedicalConsultationReason = undefined;
      if (!input.healthCenterId || !present(input.specialty))
        throw new BadRequestException(
          'Selecciona el establecimiento y la especialidad de la consulta.',
        );
      if (!input.firstConsultationDate)
        throw new BadRequestException(
          'Indica la fecha de la primera consulta.',
        );
      if (input.nextConsultationDate && !present(input.nextConsultationSpecialty))
        throw new BadRequestException(
          'Indica la especialidad de la próxima consulta.',
        );
      if (input.hasReferral === undefined)
        throw new BadRequestException(
          'Indica si hubo referencia.',
        );
      if (input.hasReferral === true && !input.referredHealthCenterId)
        throw new BadRequestException(
          'Selecciona el establecimiento de referencia.',
        );
      if (
        input.hasReferral === false &&
        !present(input.referralNotProvidedReason)
      )
        throw new BadRequestException(
          'Indica por qué no hubo referencia.',
        );
      if (input.hasReferral !== true)
        normalized.referredHealthCenterId = undefined;
      if (input.hasReferral !== false)
        normalized.referralNotProvidedReason = undefined;
      if (typeof input.hasReceivedDiagnosis !== 'boolean')
        throw new BadRequestException(
          'Indica si recibió un diagnóstico.',
        );
    } else if (
      (input.hasReferral !== undefined && input.hasReferral !== null) ||
      (input.firstConsultationDate !== undefined &&
        input.firstConsultationDate !== null) ||
      (input.isAwaitingDiagnosis !== undefined &&
        input.isAwaitingDiagnosis !== null)
    ) {
      throw new BadRequestException(
        'Indica si el paciente tuvo consulta médica.',
      );
    }

    if (
      input.hasReceivedDiagnosis === true &&
      !present(input.reportedDiagnosis)
    )
      throw new BadRequestException(
        'Indica el diagnóstico recibido.',
      );
    if (input.hasReceivedDiagnosis === false)
      normalized.reportedDiagnosis = undefined;

    if (input.attendedPrimaryCareViaSepa !== true) {
      normalized.firstPrimaryCareViaSepaAt = undefined;
    }

    if (input.isReceivingReportedTreatment === true) {
      if (
        !present(input.reportedTreatment) ||
        !input.reportedTreatmentFrequency
      )
        throw new BadRequestException(
          'Indica el tratamiento y su frecuencia.',
        );
      normalized.notReceivingTreatmentReason = undefined;
    } else if (input.isReceivingReportedTreatment === false) {
      if (!present(input.notReceivingTreatmentReason))
        throw new BadRequestException(
          'Indica por qué no recibe tratamiento.',
        );
      normalized.reportedTreatment = undefined;
      normalized.reportedTreatmentFrequency = undefined;
    }

    return normalized;
  }
}
