import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { PatientDiagnosis } from '../../../../database/entities/patient-diagnosis.entity';
import { PatientDiagnosisMode } from '../../../../database/entities/patient-diagnosis-mode.enum';
import { PatientRole } from '../../../../database/entities/patient-role.enum';
import { WaitTimeSource } from '../../../../database/entities/wait-time-source.enum';
import { HistoryVersioningService } from '../../history-versioning/history-versioning.service';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientDiagnosisDto } from './dto/create-patient-diagnosis.dto';
import { User } from '../../../../database/entities/user.entity';
import {
  durationFromElapsedDays,
  normalizeDuration,
} from '../../../../shared/duration/duration.util';
@Injectable()
export class PatientDiagnosesService {
  constructor(
    @InjectRepository(PatientDiagnosis)
    private readonly repository: Repository<PatientDiagnosis>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    private readonly patients: PatientsService,
    private readonly versioning: HistoryVersioningService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}
  async create(
    patientId: string,
    input: CreatePatientDiagnosisDto,
    manager?: EntityManager,
  ) {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    if (
      !(await (manager?.getRepository(FollowUp) ?? this.followUps).existsBy({
        id: input.followUpId,
        subjectPatientId: patientId,
      }))
    )
      throw new NotFoundException('Follow-up not found');

    const {
      mode,
      replacementDiagnosisId,
      waitTimeForDiagnosis,
      firstSymptomsDate,
      diagnosisDate,
      ...rest
    } = input;
    if (
      mode !== PatientDiagnosisMode.PARALLEL &&
      mode !== PatientDiagnosisMode.REPLACE
    )
      throw new BadRequestException(
        'Diagnosis creation mode must be PARALLEL or REPLACE',
      );
    if (
      mode === PatientDiagnosisMode.PARALLEL &&
      replacementDiagnosisId !== undefined
    )
      throw new BadRequestException(
        'replacementDiagnosisId is only valid when mode is REPLACE',
      );

    const diagnosisRepository =
      manager?.getRepository(PatientDiagnosis) ?? this.repository;
    let replacementDiagnosis: PatientDiagnosis | null = null;
    if (mode === PatientDiagnosisMode.REPLACE) {
      if (!replacementDiagnosisId)
        throw new BadRequestException(
          'replacementDiagnosisId is required when mode is REPLACE',
        );
      replacementDiagnosis = await diagnosisRepository.findOne({
        where: { id: replacementDiagnosisId },
      });
      if (!replacementDiagnosis)
        throw new NotFoundException('Replacement diagnosis not found');
      if (replacementDiagnosis.patientId !== patientId)
        throw new ConflictException(
          'Replacement diagnosis does not belong to patient',
        );
      if (!replacementDiagnosis.isCurrent)
        throw new ConflictException('Replacement diagnosis is not active');
    }

    let waitTime = normalizeDuration(waitTimeForDiagnosis);
    let waitTimeSource: WaitTimeSource | null = waitTimeForDiagnosis
      ? WaitTimeSource.REPORTED
      : null;
    if (firstSymptomsDate && diagnosisDate) {
      const first = new Date(firstSymptomsDate);
      const diagnosed = new Date(diagnosisDate);
      if (first > diagnosed)
        throw new BadRequestException(
          'firstSymptomsDate must not be after diagnosisDate',
        );
      if (!waitTimeForDiagnosis) {
        const days = Math.round(
          (diagnosed.getTime() - first.getTime()) / (1000 * 60 * 60 * 24),
        );
        waitTime = normalizeDuration(durationFromElapsedDays(days));
        waitTimeSource = WaitTimeSource.COMPUTED;
      }
    }

    const values = {
      ...rest,
      firstSymptomsDate,
      diagnosisDate,
      patientId,
      waitTimeForDiagnosis: waitTime,
      waitTimeSource,
    };
    const diagnosis =
      mode === PatientDiagnosisMode.REPLACE
        ? await (manager
            ? this.versioning.replaceCurrent(
                PatientDiagnosis,
                {
                  id: replacementDiagnosis!.id,
                  patientId,
                  isCurrent: true,
                },
                values,
                manager,
              )
            : this.versioning.replaceCurrent(
                PatientDiagnosis,
                {
                  id: replacementDiagnosis!.id,
                  patientId,
                  isCurrent: true,
                },
                values,
              ))
        : await diagnosisRepository.save(
            diagnosisRepository.create({ ...values, isCurrent: true }),
          );
    await this.invalidations.markDirty(patientId, manager);
    return diagnosis;
  }
  async findAll(patientId: string, user: User) {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }
}
