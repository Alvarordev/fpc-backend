import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { HealthCenter } from '../../../../database/entities/health-center.entity';
import { PatientDiagnosis } from '../../../../database/entities/patient-diagnosis.entity';
import { PatientDiagnosisMode } from '../../../../database/entities/patient-diagnosis-mode.enum';
import { PatientRole } from '../../../../database/entities/patient-role.enum';
import { WaitTimeSource } from '../../../../database/entities/wait-time-source.enum';
import { HistoryVersioningService } from '../../history-versioning/history-versioning.service';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientDiagnosisDto } from './dto/create-patient-diagnosis.dto';
import { UpdatePatientDiagnosisDto } from './dto/update-patient-diagnosis.dto';
import { User } from '../../../../database/entities/user.entity';
import {
  durationFromElapsedDays,
  normalizeDuration,
} from '../../../../shared/duration/duration.util';
import { CatalogValueService } from '../../../catalogs/catalog-value.service';
import { PatientSymptomReport } from '../../../../database/entities/patient-symptom-report.entity';
@Injectable()
export class PatientDiagnosesService {
  constructor(
    @InjectRepository(PatientDiagnosis)
    private readonly repository: Repository<PatientDiagnosis>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(HealthCenter)
    private readonly healthCenters: Repository<HealthCenter>,
    private readonly patients: PatientsService,
    private readonly versioning: HistoryVersioningService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly catalogValues: CatalogValueService,
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
      throw new NotFoundException('No se encontró el seguimiento.');

    const {
      mode,
      replacementDiagnosisId,
      waitTimeForDiagnosis,
      firstSymptomsDate,
      diagnosisDate,
      diagnosisOther,
      diagnosisSpecialtyOther,
      ...rest
    } = input;
    if (
      mode !== PatientDiagnosisMode.PARALLEL &&
      mode !== PatientDiagnosisMode.REPLACE
    )
      throw new BadRequestException(
        'Indica si el diagnóstico se agrega o reemplaza a otro.',
      );
    if (
      input.referredHealthCenterId &&
      !(await (
        manager?.getRepository(HealthCenter) ?? this.healthCenters
      ).existsBy({ id: input.referredHealthCenterId, isActive: true }))
    )
      throw new NotFoundException(
        'No se encontró el establecimiento de referencia.',
      );
    if (
      mode === PatientDiagnosisMode.PARALLEL &&
      replacementDiagnosisId !== undefined
    )
      throw new BadRequestException(
        'Solo se elige un diagnóstico a reemplazar al reemplazar.',
      );

    const diagnosisRepository =
      manager?.getRepository(PatientDiagnosis) ?? this.repository;
    let replacementDiagnosis: PatientDiagnosis | null = null;
    if (mode === PatientDiagnosisMode.REPLACE) {
      if (!replacementDiagnosisId)
        throw new BadRequestException(
          'Selecciona el diagnóstico a reemplazar.',
        );
      replacementDiagnosis = await diagnosisRepository.findOne({
        where: { id: replacementDiagnosisId },
      });
      if (!replacementDiagnosis)
        throw new NotFoundException(
          'No se encontró el diagnóstico a reemplazar.',
        );
      if (replacementDiagnosis.patientId !== patientId)
        throw new ConflictException(
          'El diagnóstico a reemplazar no es de este paciente.',
        );
      if (!replacementDiagnosis.isCurrent)
        throw new ConflictException(
          'El diagnóstico a reemplazar no está activo.',
        );
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
          'La fecha de primeros síntomas no puede ser posterior al diagnóstico.',
        );
      if (waitTimeForDiagnosis === undefined) {
        const days = Math.round(
          (diagnosed.getTime() - first.getTime()) / (1000 * 60 * 60 * 24),
        );
        waitTime = normalizeDuration(durationFromElapsedDays(days));
        waitTimeSource = WaitTimeSource.COMPUTED;
      }
    }

    const resolvedDiagnosis = await this.catalogValues.resolve(
      'cancer_diagnosis',
      input.diagnosis,
      { otherText: diagnosisOther, manager },
    );
    const resolvedSpecialty = await this.catalogValues.resolveOptional(
      'medical_specialty',
      input.diagnosisSpecialty,
      { otherText: diagnosisSpecialtyOther, manager },
    );
    const resolvedStage = await this.catalogValues.resolveOptional(
      'cancer_stage',
      input.cancerStage,
      { manager },
    );

    const symptomReports =
      manager?.getRepository(PatientSymptomReport) ??
      this.repository.manager?.getRepository(PatientSymptomReport);
    const hasSymptomReport = symptomReports
      ? await symptomReports.existsBy({
          patientId,
          followUpId: input.followUpId,
        })
      : false;

    const values = {
      ...rest,
      diagnosis: resolvedDiagnosis.code,
      diagnosisOther: resolvedDiagnosis.other,
      diagnosisSpecialty: resolvedSpecialty?.code ?? null,
      diagnosisSpecialtyOther: resolvedSpecialty?.other ?? null,
      ...(input.cancerStage !== undefined
        ? { cancerStage: resolvedStage?.code ?? null }
        : {}),
      symptomLeadingToCheckup: hasSymptomReport
        ? null
        : (rest.symptomLeadingToCheckup ?? null),
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
  /**
   * Corrects an active diagnosis in place, keeping its id so treatments,
   * documents and status events stay linked. The overwritten values are kept
   * in patient_diagnosis_revisions.
   */
  async update(
    patientId: string,
    diagnosisId: string,
    input: UpdatePatientDiagnosisDto,
    manager?: EntityManager,
  ): Promise<PatientDiagnosis> {
    if (!manager)
      return this.repository.manager.transaction((transactionManager) =>
        this.update(patientId, diagnosisId, input, transactionManager),
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
      throw new NotFoundException('No se encontró el seguimiento.');

    const diagnosisRepository = manager.getRepository(PatientDiagnosis);
    const diagnosis = await diagnosisRepository.findOne({
      where: { id: diagnosisId, patientId },
    });
    if (!diagnosis)
      throw new NotFoundException('No se encontró el diagnóstico.');
    if (!diagnosis.isCurrent)
      throw new ConflictException(
        'Solo se puede corregir un diagnóstico activo.',
      );
    if (
      input.referredHealthCenterId &&
      !(await manager
        .getRepository(HealthCenter)
        .existsBy({ id: input.referredHealthCenterId, isActive: true }))
    )
      throw new NotFoundException(
        'No se encontró el establecimiento de referencia.',
      );

    const {
      followUpId: _followUpId,
      changeReason,
      waitTimeForDiagnosis,
      diagnosisSpecialty,
      diagnosisSpecialtyOther,
      cancerStage,
      ...rest
    } = input;
    const next: Partial<PatientDiagnosis> = {};
    for (const [key, value] of Object.entries(rest))
      if (value !== undefined) (next as Record<string, unknown>)[key] = value;

    // Re-sending the same specialty without its "other" text keeps that text.
    const keepsSpecialty =
      diagnosisSpecialty === diagnosis.diagnosisSpecialty &&
      diagnosisSpecialtyOther === undefined;
    if (diagnosisSpecialty !== undefined && !keepsSpecialty) {
      const resolved = await this.catalogValues.resolveOptional(
        'medical_specialty',
        diagnosisSpecialty ?? undefined,
        { otherText: diagnosisSpecialtyOther ?? undefined, manager },
      );
      next.diagnosisSpecialty = resolved?.code ?? null;
      next.diagnosisSpecialtyOther = resolved?.other ?? null;
    }
    if (cancerStage !== undefined) {
      const resolved = await this.catalogValues.resolveOptional(
        'cancer_stage',
        cancerStage ?? undefined,
        { manager },
      );
      next.cancerStage = resolved?.code ?? null;
    }

    const firstSymptomsDate =
      next.firstSymptomsDate !== undefined
        ? next.firstSymptomsDate
        : diagnosis.firstSymptomsDate;
    const diagnosisDate =
      next.diagnosisDate !== undefined
        ? next.diagnosisDate
        : diagnosis.diagnosisDate;
    if (
      firstSymptomsDate &&
      diagnosisDate &&
      new Date(firstSymptomsDate) > new Date(diagnosisDate)
    )
      throw new BadRequestException(
        'La fecha de primeros síntomas no puede ser posterior al diagnóstico.',
      );
    if (waitTimeForDiagnosis !== undefined) {
      next.waitTimeForDiagnosis = normalizeDuration(waitTimeForDiagnosis);
      next.waitTimeSource = waitTimeForDiagnosis
        ? WaitTimeSource.REPORTED
        : null;
    } else if (firstSymptomsDate && diagnosisDate) {
      const days = Math.round(
        (new Date(diagnosisDate).getTime() -
          new Date(firstSymptomsDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      next.waitTimeForDiagnosis = normalizeDuration(
        durationFromElapsedDays(days),
      );
      next.waitTimeSource = WaitTimeSource.COMPUTED;
    }

    // Only fields that actually change are written.
    const changes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(next)) {
      const previous = (diagnosis as unknown as Record<string, unknown>)[key];
      if (JSON.stringify(previous ?? null) === JSON.stringify(value ?? null))
        continue;
      changes[key] = value;
    }
    if (Object.keys(changes).length === 0) return diagnosis;

    // The audit trigger logs each overwritten field in change_log.
    Object.assign(diagnosis, changes, { changeReason: changeReason.trim() });
    const saved = await diagnosisRepository.save(diagnosis);
    await this.invalidations.markDirty(patientId, manager);
    return saved;
  }
  async findAll(patientId: string, user: User) {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      relations: { healthCenter: true, referredHealthCenter: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }
}
