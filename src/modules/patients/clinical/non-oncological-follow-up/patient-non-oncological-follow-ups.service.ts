import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Enrollment } from '../../../../database/entities/enrollment.entity';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { PatientNonOncologicalFollowUp } from '../../../../database/entities/patient-non-oncological-follow-up.entity';
import { PatientNonOncologicalFollowUpStatus } from '../../../../database/entities/patient-non-oncological-follow-up-status.enum';
import { PatientRole } from '../../../../database/entities/patient-role.enum';
import { User } from '../../../../database/entities/user.entity';
import { dateOnlyInLima } from '../../../../shared/date-only/date-only.util';
import { normalizeDuration } from '../../../../shared/duration/duration.util';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { PatientsService } from '../../patients.service';
import { CatalogValueService } from '../../../catalogs/catalog-value.service';
import {
  CreatePatientNonOncologicalFollowUpDto,
  UpdatePatientNonOncologicalFollowUpDto,
} from './dto/create-patient-non-oncological-follow-up.dto';

type CreateFollowUpInput = CreatePatientNonOncologicalFollowUpDto & {
  status?: PatientNonOncologicalFollowUpStatus;
};

@Injectable()
export class PatientNonOncologicalFollowUpsService {
  constructor(
    @InjectRepository(PatientNonOncologicalFollowUp)
    private readonly repository: Repository<PatientNonOncologicalFollowUp>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(Enrollment)
    private readonly enrollments: Repository<Enrollment>,
    private readonly dataSource: DataSource,
    private readonly patients: PatientsService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly catalogValues: CatalogValueService,
  ) {}

  async create(
    patientId: string,
    input: CreateFollowUpInput,
    manager?: EntityManager,
  ): Promise<PatientNonOncologicalFollowUp> {
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
    await this.assertRelations(patientId, input, manager);
    const specialty = await this.catalogValues.resolveOptional(
      'medical_specialty',
      input.controlSpecialty,
      { manager },
    );
    const normalized = this.normalize({
      ...input,
      controlSpecialty: specialty?.code ?? input.controlSpecialty,
    });
    const repository = manager.getRepository(PatientNonOncologicalFollowUp);
    const record = await repository.save(
      repository.create({
        ...normalized,
        patientId,
        status: input.status ?? PatientNonOncologicalFollowUpStatus.ACTIVE,
      }),
    );
    await this.invalidations.markDirty(patientId, manager);
    return record;
  }

  async findAll(
    patientId: string,
    user: User,
  ): Promise<PatientNonOncologicalFollowUp[]> {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      order: { occurredOn: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  }

  async update(
    patientId: string,
    id: string,
    input: UpdatePatientNonOncologicalFollowUpDto,
  ): Promise<PatientNonOncologicalFollowUp> {
    return this.dataSource.transaction(async (manager) => {
      await this.patients.assertPatientRole(
        patientId,
        PatientRole.PATIENT,
        undefined,
        manager,
      );
      const repository = manager.getRepository(PatientNonOncologicalFollowUp);
      const existing = await repository.findOne({
        where: { id, patientId },
      });
      if (!existing)
        throw new NotFoundException('Non-oncological follow-up not found');

      const merged = {
        ...existing,
        ...input,
        diagnosis: input.diagnosis ?? existing.diagnosis,
        receivesTreatment:
          input.receivesTreatment !== undefined
            ? input.receivesTreatment
            : existing.receivesTreatment,
        hasControls:
          input.hasControls !== undefined
            ? input.hasControls
            : existing.hasControls,
      };
      const normalized = this.normalize(merged);
      Object.assign(existing, normalized);
      if (input.status === PatientNonOncologicalFollowUpStatus.ACTIVE) {
        existing.dischargedOn = null;
        existing.dischargeReason = null;
      }
      const saved = await repository.save(existing);
      await this.invalidations.markDirty(patientId, manager);
      return saved;
    });
  }

  async upsertHistorical(
    patientId: string,
    followUpId: string,
    input: UpdatePatientNonOncologicalFollowUpDto & { id?: string },
    manager: EntityManager,
  ): Promise<PatientNonOncologicalFollowUp> {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    const repository = manager.getRepository(PatientNonOncologicalFollowUp);
    if (!input.id)
      return this.create(
        patientId,
        { ...input, followUpId, diagnosis: input.diagnosis ?? '' },
        manager,
      );

    const existing = await repository.findOne({
      where: { id: input.id, patientId, followUpId },
    });
    if (!existing)
      throw new NotFoundException(
        'Non-oncological follow-up not found for this historical follow-up',
      );
    const normalized = this.normalize({
      ...existing,
      ...input,
      followUpId,
    });
    Object.assign(existing, normalized);
    if (input.status === PatientNonOncologicalFollowUpStatus.ACTIVE) {
      existing.dischargedOn = null;
      existing.dischargeReason = null;
    }
    const saved = await repository.save(existing);
    await this.invalidations.markDirty(patientId, manager);
    return saved;
  }

  private async assertRelations(
    patientId: string,
    input: CreatePatientNonOncologicalFollowUpDto,
    manager: EntityManager,
  ): Promise<void> {
    if (
      input.followUpId &&
      !(await manager.getRepository(FollowUp).existsBy({
        id: input.followUpId,
        subjectPatientId: patientId,
      }))
    )
      throw new NotFoundException('Follow-up not found');
    if (
      input.enrollmentId &&
      !(await manager.getRepository(Enrollment).existsBy({
        id: input.enrollmentId,
        patientId,
      }))
    )
      throw new NotFoundException('Enrollment not found');
  }

  private normalize(input: {
    followUpId?: string | null;
    enrollmentId?: string | null;
    diagnosticStatusEventId?: string | null;
    diagnosis?: string | null;
    occurredOn?: string | null;
    receivesTreatment?: boolean | null;
    treatmentName?: string | null;
    medication?: string | null;
    treatmentFrequency?: unknown;
    hasControls?: boolean | null;
    controlSpecialty?: string | null;
    controlPeriodicity?: unknown;
    status?: PatientNonOncologicalFollowUpStatus;
    dischargedOn?: string | null;
    dischargeReason?: string | null;
  }) {
    const diagnosis = input.diagnosis?.trim();
    if (!diagnosis) throw new BadRequestException('diagnosis is required');
    if (
      input.hasControls === true &&
      (!input.controlSpecialty?.trim() || !input.controlPeriodicity)
    )
      throw new BadRequestException(
        'controlSpecialty and controlPeriodicity are required when controls are active',
      );
    if (
      input.status === PatientNonOncologicalFollowUpStatus.DISCHARGED &&
      !input.dischargeReason?.trim()
    )
      throw new BadRequestException(
        'dischargeReason is required when the follow-up is discharged',
      );

    return {
      followUpId: input.followUpId,
      enrollmentId: input.enrollmentId ?? null,
      diagnosticStatusEventId: input.diagnosticStatusEventId ?? null,
      diagnosis,
      occurredOn: input.occurredOn ?? dateOnlyInLima(new Date()),
      receivesTreatment: input.receivesTreatment ?? null,
      treatmentName:
        input.receivesTreatment === false
          ? null
          : input.treatmentName?.trim() || null,
      medication:
        input.receivesTreatment === false
          ? null
          : input.medication?.trim() || null,
      treatmentFrequency:
        input.receivesTreatment === false
          ? normalizeDuration(null)
          : normalizeDuration(input.treatmentFrequency as never),
      hasControls: input.hasControls ?? null,
      controlSpecialty:
        input.hasControls === false
          ? null
          : input.controlSpecialty?.trim() || null,
      controlPeriodicity:
        input.hasControls === false
          ? normalizeDuration(null)
          : normalizeDuration(input.controlPeriodicity as never),
      ...(input.status !== undefined ? { status: input.status } : {}),
      dischargedOn:
        input.status === PatientNonOncologicalFollowUpStatus.ACTIVE
          ? null
          : (input.dischargedOn ?? null),
      dischargeReason:
        input.status === PatientNonOncologicalFollowUpStatus.ACTIVE
          ? null
          : input.dischargeReason?.trim() || null,
    };
  }
}
