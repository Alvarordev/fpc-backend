import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FollowUp } from '../../database/entities/follow-up.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
} from '../../database/entities/follow-up.enums';
import { FollowUpReenrollment } from '../../database/entities/follow-up-reenrollment.entity';
import { Patient } from '../../database/entities/patient.entity';
import { PatientActivityStatus } from '../../database/entities/patient-activity-status.enum';
import { User } from '../../database/entities/user.entity';
import { AuditContextKind } from '../../shared/audit/audit-context';
import { AuditContextService } from '../../shared/audit/audit-context.service';
import { dateOnlyInLima } from '../../shared/date-only/date-only.util';
import { CatalogValueService } from '../catalogs/catalog-value.service';
import { CatalogsService } from '../catalogs/catalogs.service';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { PatientsService } from '../patients/patients.service';
import {
  CreateReenrollmentDto,
  ReenrollmentResponseDto,
} from './dto/reenrollment.dto';

/**
 * Un paciente inactivo vuelve al programa con un seguimiento de propósito
 * REENROLLMENT: se registran motivo, canal de ingreso y situación de salud, y
 * se lo reactiva ligado a ese seguimiento. No repite el enrolamiento.
 */
@Injectable()
export class ReenrollmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly followUps: FollowUpsService,
    private readonly patients: PatientsService,
    private readonly catalogValues: CatalogValueService,
    private readonly catalogs: CatalogsService,
    private readonly audit: AuditContextService,
  ) {}

  async findForFollowUp(followUpId: string, user: User) {
    await this.followUps.findOneForUser(followUpId, user);
    const item = await this.dataSource
      .getRepository(FollowUpReenrollment)
      .findOneBy({ followUpId });
    if (!item)
      throw new NotFoundException(
        'Este seguimiento todavía no tiene un reenrolamiento registrado.',
      );
    return this.toResponse(item);
  }

  async create(followUpId: string, input: CreateReenrollmentDto, user: User) {
    await this.followUps.findOneForUser(followUpId, user);
    const item = await this.dataSource.transaction(async (manager) => {
      const followUp = await manager
        .getRepository(FollowUp)
        .createQueryBuilder('follow_up')
        .setLock('pessimistic_write')
        .where('follow_up.id = :id', { id: followUpId })
        .getOne();
      if (!followUp)
        throw new NotFoundException('No se encontró el seguimiento.');
      await this.followUps.assertWriteScope(
        followUp,
        user.id,
        user.role,
        manager,
      );
      if (followUp.purpose !== FollowUpPurpose.REENROLLMENT)
        throw new BadRequestException(
          'Este seguimiento no es de reenrolamiento.',
        );
      if (followUp.status === FollowUpStatus.CANCELLED)
        throw new BadRequestException(
          'No se puede reenrolar desde un seguimiento cancelado.',
        );
      const repository = manager.getRepository(FollowUpReenrollment);
      if (await repository.existsBy({ followUpId }))
        throw new ConflictException(
          'Este seguimiento ya tiene un reenrolamiento registrado.',
        );
      const patient = await manager
        .getRepository(Patient)
        .findOneBy({ id: followUp.subjectPatientId });
      if (!patient) throw new NotFoundException('No se encontró el paciente.');
      if (patient.activityStatus !== PatientActivityStatus.INACTIVE)
        throw new ConflictException(
          'El paciente ya está activo; no hace falta reenrolarlo.',
        );

      const [reason, entrySource, entrySubSource] = await Promise.all([
        this.catalogValues.resolve('reenrollment_reason', input.reason, {
          manager,
        }),
        this.catalogValues.resolve('entry_source', input.entrySource, {
          manager,
        }),
        this.catalogValues.resolveOptional(
          'entry_sub_source',
          input.entrySubSource,
          { manager },
        ),
      ]);
      if (entrySubSource) {
        const subItem = (await this.catalogs.findAll('entry_sub_source')).find(
          (catalogItem) => catalogItem.code === entrySubSource.code,
        );
        if (subItem?.parentCode && subItem.parentCode !== entrySource.code)
          throw new BadRequestException(
            'El detalle de cómo se enteró no corresponde al punto de ingreso.',
          );
      }

      await this.audit.attachFollowUp(
        manager,
        followUp.id,
        AuditContextKind.FOLLOW_UP,
      );
      await this.patients.upsertDetails(
        patient.id,
        {
          healthPhase: input.healthPhase,
          ...(input.healthSubcategory !== undefined
            ? { healthSubcategory: input.healthSubcategory }
            : {}),
        },
        manager,
      );
      await this.patients.reactivate(
        patient.id,
        { followUpId: followUp.id },
        manager,
      );
      if (followUp.status !== FollowUpStatus.COMPLETED) {
        const now = new Date();
        followUp.status = FollowUpStatus.COMPLETED;
        followUp.completedAt = followUp.completedAt ?? now;
        followUp.completedOn =
          followUp.completedOn ?? dateOnlyInLima(followUp.completedAt);
        await manager.getRepository(FollowUp).save(followUp);
      }
      return repository.save(
        repository.create({
          followUpId: followUp.id,
          patientId: patient.id,
          reason: reason.code,
          entrySource: entrySource.code,
          entrySubSource: entrySubSource?.code ?? null,
          healthPhase: input.healthPhase,
          healthSubcategory: input.healthSubcategory ?? null,
          contactDataConfirmedAt: new Date(),
          notes: input.notes?.trim() || null,
          createdById: user.id,
        }),
      );
    });
    return this.toResponse(item);
  }

  private async toResponse(item: FollowUpReenrollment) {
    const reason = (await this.catalogs.findAll('reenrollment_reason')).find(
      (catalogItem) => catalogItem.code === item.reason,
    );
    return ReenrollmentResponseDto.from(item, reason?.label ?? item.reason);
  }
}
