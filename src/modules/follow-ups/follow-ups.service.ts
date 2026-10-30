import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity';
import {
  FollowUpAttemptOutcome,
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../../database/entities/follow-up.enums';
import { PatientActivityStatus } from '../../database/entities/patient-activity-status.enum';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { FollowUpAttempt } from '../../database/entities/follow-up-attempt.entity';
import { Reminder } from '../../database/entities/reminder.entity';
import { Patient } from '../../database/entities/patient.entity';
import { CompanionPatient } from '../../database/entities/companion-patient.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { FindFollowUpsQueryDto } from './dto/list-follow-ups.dto';
import { UpdateFollowUpDto } from './dto/update-follow-up.dto';
import { CreateFollowUpsBatchDto } from './dto/create-follow-ups-batch.dto';
import { CreateReminderDto } from '../reminders/dto/create-reminder.dto';
import { RemindersService } from '../reminders/reminders.service';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import { PatientAccessService } from '../patients/access/patient-access.service';
import { User } from '../../database/entities/user.entity';
import { AuditContextService } from '../../shared/audit/audit-context.service';
import { AuditContextKind } from '../../shared/audit/audit-context';
import { CreateFollowUpAttemptDto } from './dto/create-follow-up-attempt.dto';
import { RescheduleFollowUpDto } from './dto/reschedule-follow-up.dto';
import {
  dateOnlyInLima,
  dateOnlyInLimaFromInput,
} from '../../shared/date-only/date-only.util';

// Un seguimiento puede realizarse antes de su fecha programada (se adelanta
// la llamada): se conservan ambas fechas y no se exige un orden entre ellas.

export interface FollowUpCreateOptions {
  isHistorical?: boolean;
  historicalLoadedById?: string;
  status?: FollowUpStatus;
  scheduledOn?: string;
  completedOn?: string;
}

export interface HistoricalFollowUpInput extends CreateFollowUpDto {
  status: FollowUpStatus;
  scheduledOn?: string;
  completedOn?: string;
}

const RESCHEDULABLE = [FollowUpStatus.OVERDUE, FollowUpStatus.CANCELLED];

/*
 * "Recovered" follow-ups (S5): first attempt failed, a later one reached the
 * patient.
 *
 *   SELECT count(*) FROM follow_ups f
 *   WHERE (SELECT a.outcome FROM follow_up_attempts a
 *          WHERE a.follow_up_id = f.id
 *          ORDER BY a.occurred_at, a.created_at LIMIT 1) <> 'CONTACTED'
 *     AND EXISTS (SELECT 1 FROM follow_up_attempts a
 *                 WHERE a.follow_up_id = f.id AND a.outcome = 'CONTACTED');
 */
@Injectable()
export class FollowUpsService {
  private readonly logger = new Logger(FollowUpsService.name);

  constructor(
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectRepository(Reminder)
    private readonly reminders: Repository<Reminder>,
    private readonly dataSource: DataSource,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly access: PatientAccessService,
    @Inject(forwardRef(() => RemindersService))
    private readonly remindersService: RemindersService,
    private readonly audit: AuditContextService,
  ) {}
  // Reuses the patient's most recent follow-up, or creates a minimal
  // IN_PERSON/COMPLETED one, matching fpc-back's standalone-appointment
  // behaviour. Unlike AlertsService.createFollowUp (which always creates a
  // new one), this always tries to reuse first.
  async resolveOrCreateForPatient(
    patientId: string,
    agentId: string,
    manager?: EntityManager,
  ): Promise<string> {
    const followUps = manager?.getRepository(FollowUp) ?? this.followUps;
    const existing = await followUps.findOne({
      where: { subjectPatientId: patientId },
      order: { createdAt: 'DESC' },
    });
    if (existing) return existing.id;

    const created = await followUps.save(
      followUps.create({
        subjectPatientId: patientId,
        interlocutorCompanionId: null,
        agentId,
        type: FollowUpType.IN_PERSON,
        status: FollowUpStatus.COMPLETED,
        purpose: FollowUpPurpose.FOLLOW_UP,
        scheduledAt: null,
        completedAt: new Date(),
        completedOn: dateOnlyInLima(new Date()),
        scheduledOn: null,
        isHistorical: false,
        notes: 'Cita registrada desde panel web',
        nextFollowUpId: null,
      }),
    );
    return created.id;
  }

  inferStatus(
    input: Pick<CreateFollowUpDto, 'scheduledAt' | 'completedAt'>,
  ): FollowUpStatus {
    return input.completedAt
      ? FollowUpStatus.COMPLETED
      : input.scheduledAt && new Date(input.scheduledAt) > new Date()
        ? FollowUpStatus.SCHEDULED
        : FollowUpStatus.COMPLETED;
  }
  async create(
    input: CreateFollowUpDto,
    userId: string,
    userRole: string,
    manager?: EntityManager,
    options: FollowUpCreateOptions = {},
  ) {
    await this.assertPatients(manager, input.subjectPatientId);
    const interlocutorCompanionId = await this.resolveInterlocutor(
      input.subjectPatientId,
      input.interlocutorId,
      manager,
    );
    if (
      input.purpose === FollowUpPurpose.REENROLLMENT &&
      !options.isHistorical &&
      !(await (manager?.getRepository(Patient) ?? this.patients).existsBy({
        id: input.subjectPatientId,
        activityStatus: PatientActivityStatus.INACTIVE,
      }))
    )
      throw new BadRequestException(
        'Solo se puede reenrolar a un paciente inactivo.',
      );
    const agents = manager?.getRepository(Agent) ?? this.agents;
    const followUps = manager?.getRepository(FollowUp) ?? this.followUps;
    const agentId = await this.resolveAgentId(
      input.agentId,
      userId,
      userRole,
      agents,
    );
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const completedAt = input.completedAt ? new Date(input.completedAt) : null;
    const scheduledOn =
      options.scheduledOn !== undefined
        ? options.scheduledOn
        : input.scheduledAt
          ? dateOnlyInLimaFromInput(input.scheduledAt)
          : null;
    const completedOn =
      options.completedOn !== undefined
        ? options.completedOn
        : input.completedAt
          ? dateOnlyInLimaFromInput(input.completedAt)
          : null;
    if (
      input.scheduledAt &&
      scheduledOn &&
      dateOnlyInLimaFromInput(input.scheduledAt) !== scheduledOn
    )
      throw new BadRequestException(
        'La hora programada no coincide con su fecha.',
      );
    if (
      input.completedAt &&
      completedOn &&
      dateOnlyInLimaFromInput(input.completedAt) !== completedOn
    )
      throw new BadRequestException(
        'La hora de realización no coincide con su fecha.',
      );
    const followUp = await followUps.save(
      followUps.create({
        ...withoutInterlocutor(input),
        interlocutorCompanionId,
        agentId,
        status: options.status ?? this.inferStatus(input),
        scheduledAt,
        completedAt,
        scheduledOn,
        completedOn,
        isHistorical: options.isHistorical ?? false,
        historicalLoadedById: options.isHistorical
          ? (options.historicalLoadedById ?? userId)
          : null,
      }),
    );
    if (
      followUp.status === FollowUpStatus.COMPLETED ||
      followUp.status === FollowUpStatus.NO_ANSWER
    )
      await (manager?.getRepository(FollowUpAttempt) ?? this.attempts()).save({
        followUpId: followUp.id,
        patientId: followUp.subjectPatientId,
        channel: followUp.type,
        outcome:
          followUp.status === FollowUpStatus.COMPLETED
            ? FollowUpAttemptOutcome.CONTACTED
            : FollowUpAttemptOutcome.NO_ANSWER,
        occurredAt: followUp.completedAt ?? new Date(),
        actorUserId: userId,
        notes: null,
      });
    await this.invalidations.markDirty(followUp.subjectPatientId, manager);
    return followUp;
  }

  private attempts(manager?: EntityManager) {
    return (manager ?? this.dataSource.manager).getRepository(FollowUpAttempt);
  }

  async createHistorical(
    input: HistoricalFollowUpInput,
    userId: string,
    userRole: string,
    manager?: EntityManager,
  ) {
    const run = (entityManager: EntityManager) =>
      this.create(
        {
          subjectPatientId: input.subjectPatientId,
          interlocutorId: input.interlocutorId,
          agentId: input.agentId,
          type: input.type,
          purpose: input.purpose,
          notes: input.notes,
          scheduledAt: input.scheduledAt,
          completedAt: input.completedAt,
        },
        userId,
        userRole,
        entityManager,
        {
          isHistorical: true,
          historicalLoadedById: userId,
          status: input.status,
          scheduledOn: input.scheduledOn,
          completedOn: input.completedOn,
        },
      );

    const created = manager
      ? await run(manager)
      : await this.dataSource.transaction((entityManager) =>
          run(entityManager),
        );
    return this.findOne(created.id, manager);
  }

  async updateHistoricalMetadata(
    id: string,
    input: {
      interlocutorId?: string;
      agentId?: string;
      type?: FollowUpType;
      purpose?: FollowUpPurpose;
      status?: FollowUpStatus;
      notes?: string;
      scheduledOn?: string | null;
      completedOn?: string | null;
      scheduledAt?: string | null;
      completedAt?: string | null;
    },
    manager?: EntityManager,
  ) {
    const followUps = manager?.getRepository(FollowUp) ?? this.followUps;
    const item = await this.findOne(id, manager);
    if (!item.isHistorical)
      throw new BadRequestException(
        'Desde carga histórica solo se editan seguimientos históricos.',
      );
    if (input.interlocutorId)
      item.interlocutorCompanionId = await this.resolveInterlocutor(
        item.subjectPatientId,
        input.interlocutorId,
        manager,
      );
    if (input.agentId !== undefined) {
      const agents = manager?.getRepository(Agent) ?? this.agents;
      if (!(await agents.existsBy({ id: input.agentId })))
        throw new NotFoundException('No se encontró el agente.');
      item.agentId = input.agentId;
    }
    if (input.type !== undefined) item.type = input.type;
    if (input.purpose !== undefined) item.purpose = input.purpose;
    if (input.status !== undefined) item.status = input.status;
    if (input.notes !== undefined) item.notes = input.notes;
    if (input.scheduledOn !== undefined) item.scheduledOn = input.scheduledOn;
    if (input.completedOn !== undefined) item.completedOn = input.completedOn;
    if (input.scheduledAt !== undefined)
      item.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (input.completedAt !== undefined)
      item.completedAt = input.completedAt ? new Date(input.completedAt) : null;
    const saved = await followUps.save(item);
    await this.invalidations.markDirty(saved.subjectPatientId, manager);
    return saved;
  }

  async deleteHistorical(id: string, manager: EntityManager) {
    const item = await this.findOne(id, manager);
    if (!item.isHistorical)
      throw new BadRequestException(
        'Solo se pueden eliminar seguimientos históricos',
      );
    await manager.getRepository(FollowUp).delete({ id });
    await this.invalidations.markDirty(item.subjectPatientId, manager);
    return item;
  }
  async createBatch(
    input: CreateFollowUpsBatchDto,
    userId: string,
    userRole: string,
  ) {
    const patientIds = new Set(
      input.followUps.map((followUp) => followUp.subjectPatientId),
    );
    if (patientIds.size !== 1) {
      throw new BadRequestException(
        'Todos los seguimientos planificados deben ser del mismo paciente.',
      );
    }

    const now = Date.now();
    for (const followUp of input.followUps) {
      const scheduledAt = followUp.scheduledAt
        ? new Date(followUp.scheduledAt).getTime()
        : Number.NaN;
      if (!Number.isFinite(scheduledAt) || scheduledAt <= now) {
        throw new BadRequestException(
          'Los seguimientos planificados deben tener una fecha futura.',
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const created: FollowUp[] = [];
      for (const followUp of input.followUps) {
        const createdFollowUp = await this.create(
          followUp,
          userId,
          userRole,
          manager,
        );
        if (createdFollowUp.status !== FollowUpStatus.SCHEDULED) {
          throw new BadRequestException(
            'Los seguimientos planificados deben tener una fecha futura.',
          );
        }
        created.push(createdFollowUp);
      }
      return created;
    });
  }
  async findOne(id: string, manager?: EntityManager) {
    const item = await (
      manager?.getRepository(FollowUp) ?? this.followUps
    ).findOne({ where: { id }, relations: { subjectPatient: true } });
    if (!item) throw new NotFoundException('No se encontró el seguimiento.');
    return item;
  }
  async findOneForUser(id: string, user: User) {
    const item = await this.findOne(id);
    await this.access.assertCanRead(item.subjectPatientId, user);
    item.attempts = await this.attempts().find({
      where: { followUpId: id },
      order: { occurredAt: 'ASC', createdAt: 'ASC' },
    });
    return item;
  }

  async addAttempt(id: string, input: CreateFollowUpAttemptDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const followUp = await this.findOne(id, manager);
      await this.assertWriteScope(followUp, user.id, user.role, manager);
      if (followUp.status === FollowUpStatus.CANCELLED)
        throw new BadRequestException(
          'Un seguimiento cancelado no admite intentos; reprográmalo.',
        );
      const occurredAt = input.occurredAt
        ? new Date(input.occurredAt)
        : new Date();
      const attempt = await manager.getRepository(FollowUpAttempt).save({
        followUpId: followUp.id,
        patientId: followUp.subjectPatientId,
        channel: input.channel,
        outcome: input.outcome,
        occurredAt,
        actorUserId: user.id,
        notes: input.notes ?? null,
      });
      if (input.outcome === FollowUpAttemptOutcome.CONTACTED) {
        if (followUp.status !== FollowUpStatus.COMPLETED) {
          followUp.status = FollowUpStatus.COMPLETED;
          followUp.completedAt = occurredAt;
          followUp.completedOn = dateOnlyInLima(occurredAt);
        }
      } else if (followUp.status !== FollowUpStatus.COMPLETED) {
        followUp.status = FollowUpStatus.NO_ANSWER;
      }
      await manager.getRepository(FollowUp).save(followUp);
      await this.invalidations.markDirty(followUp.subjectPatientId, manager);
      return attempt;
    });
  }

  async reschedule(id: string, input: RescheduleFollowUpDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.findOne(id, manager);
      await this.assertWriteScope(current, user.id, user.role, manager);
      if (!RESCHEDULABLE.includes(current.status))
        throw new BadRequestException(
          'Solo se puede reprogramar un seguimiento vencido o cancelado.',
        );
      if (current.nextFollowUpId)
        throw new BadRequestException('El seguimiento ya fue reprogramado.');
      if (new Date(input.scheduledAt).getTime() <= Date.now())
        throw new BadRequestException('La fecha programada debe ser futura.');
      const next = await this.create(
        {
          subjectPatientId: current.subjectPatientId,
          interlocutorId: interlocutorIdOf(current),
          agentId:
            user.role === UserRole.AGENT
              ? undefined
              : (input.agentId ?? current.agentId),
          type: input.type ?? current.type,
          purpose: current.purpose,
          notes: input.notes ?? current.notes ?? undefined,
          scheduledAt: input.scheduledAt,
        },
        user.id,
        user.role,
        manager,
      );
      current.nextFollowUpId = next.id;
      await manager.getRepository(FollowUp).save(current);
      return next;
    });
  }

  @Cron('10 0 * * *', { timeZone: 'America/Lima' })
  async markOverdue(today = dateOnlyInLima(new Date())) {
    const rows = await this.audit.run(
      { actorUserId: null, context: AuditContextKind.SYSTEM },
      () =>
        this.dataSource.transaction(async (manager) => {
          const [updated]: [{ subject_patient_id: string }[], number] =
            await manager.query(
              `UPDATE follow_ups
                SET status = $1, updated_at = now()
              WHERE status = $2 AND is_historical = false AND scheduled_on < $3
              RETURNING subject_patient_id`,
              [FollowUpStatus.OVERDUE, FollowUpStatus.SCHEDULED, today],
            );
          for (const patientId of new Set(
            updated.map((row) => row.subject_patient_id),
          ))
            await this.invalidations.markDirty(patientId, manager);
          return updated;
        }),
    );
    if (rows.length)
      this.logger.log(`Marked ${rows.length} follow-ups as overdue`);
    return rows.length;
  }
  async findAllForUser(queryInput: FindFollowUpsQueryDto, user: User) {
    const query = this.followUps
      .createQueryBuilder('follow_up')
      .leftJoinAndSelect('follow_up.subjectPatient', 'subject_patient')
      .orderBy(
        'COALESCE(follow_up.completed_on, follow_up.scheduled_on)',
        'ASC',
        'NULLS LAST',
      )
      .addOrderBy(
        'COALESCE(follow_up.completed_at, follow_up.scheduled_at)',
        'ASC',
        'NULLS LAST',
      )
      .addOrderBy('follow_up.created_at', 'DESC')
      .addOrderBy('follow_up.id', 'DESC');

    // R-11: inside a patient file an agent sees every follow-up of the
    // patient; "my follow-ups" is only the default of the agenda.
    if (user.role === UserRole.AGENT && !queryInput.patientId) {
      const agent = await this.agents.findOne({ where: { userId: user.id } });
      if (!agent)
        throw new BadRequestException('Tu usuario no tiene perfil de agente.');
      query.andWhere('follow_up.agent_id = :agentId', {
        agentId: queryInput.agentId ?? agent.id,
      });
    } else if (queryInput.agentId) {
      query.andWhere('follow_up.agent_id = :agentId', {
        agentId: queryInput.agentId,
      });
    }

    if (queryInput.patientId)
      query.andWhere('follow_up.subject_patient_id = :patientId', {
        patientId: queryInput.patientId,
      });
    if (queryInput.status)
      query.andWhere('follow_up.status = :status', {
        status: queryInput.status,
      });

    await this.access.scopeQuery(query, 'follow_up.subject_patient_id', user);
    return query.getMany();
  }
  async scheduleNext(
    id: string,
    input: CreateFollowUpDto,
    userId: string,
    role: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.findOne(id, manager);
      await this.assertWriteScope(current, userId, role, manager);
      const next = await this.create(
        {
          ...input,
          subjectPatientId: current.subjectPatientId,
          interlocutorId: input.interlocutorId ?? interlocutorIdOf(current),
          scheduledAt:
            input.scheduledAt ?? new Date(Date.now() + 60000).toISOString(),
          completedAt: undefined,
        },
        userId,
        role,
        manager,
      );
      current.nextFollowUpId = next.id;
      await manager.getRepository(FollowUp).save(current);
      await this.invalidations.markDirty(current.subjectPatientId, manager);
      return next;
    });
  }
  async update(
    id: string,
    input: UpdateFollowUpDto,
    userId: string,
    userRole: string,
  ) {
    const item = await this.findOne(id);
    await this.assertWriteScope(item, userId, userRole);
    if (input.interlocutorId)
      item.interlocutorCompanionId = await this.resolveInterlocutor(
        item.subjectPatientId,
        input.interlocutorId,
      );
    Object.assign(
      item,
      withoutInterlocutor(input),
      input.scheduledAt ? { scheduledAt: new Date(input.scheduledAt) } : {},
      input.completedAt ? { completedAt: new Date(input.completedAt) } : {},
    );
    if (input.scheduledAt !== undefined)
      item.scheduledOn = input.scheduledAt
        ? dateOnlyInLimaFromInput(input.scheduledAt)
        : null;
    if (input.completedAt !== undefined)
      item.completedOn = input.completedAt
        ? dateOnlyInLimaFromInput(input.completedAt)
        : null;
    const followUp = await this.followUps.save(item);
    await this.invalidations.markDirty(followUp.subjectPatientId);
    return followUp;
  }
  async createReminder(
    id: string,
    input: Omit<
      CreateReminderDto,
      'subjectPatientId' | 'createdFromFollowUpId'
    >,
    user: User,
  ) {
    const followUp = await this.findOne(id);
    await this.assertWriteScope(followUp, user.id, user.role);
    return this.remindersService.create(
      {
        ...input,
        subjectPatientId: followUp.subjectPatientId,
        createdFromFollowUpId: id,
      },
      user,
    );
  }
  private async resolveAgentId(
    requestedAgentId: string | undefined,
    userId: string,
    userRole: string,
    agents: Repository<Agent>,
  ) {
    if (userRole === 'AGENT') {
      const agent = await agents.findOne({ where: { userId } });
      if (!agent)
        throw new BadRequestException('Tu usuario no tiene perfil de agente.');
      if (requestedAgentId && requestedAgentId !== agent.id)
        throw new ForbiddenException(
          'No puedes asignar seguimientos a otro agente.',
        );
      return agent.id;
    }
    if (!requestedAgentId)
      throw new BadRequestException('Selecciona el agente responsable.');
    if (!(await agents.existsBy({ id: requestedAgentId })))
      throw new NotFoundException('No se encontró el agente.');
    return requestedAgentId;
  }
  async assertWriteScope(
    followUp: FollowUp,
    userId: string,
    userRole: string,
    manager?: EntityManager,
  ) {
    if (userRole !== 'AGENT') return;
    const agents = manager?.getRepository(Agent) ?? this.agents;
    const agent = await agents.findOne({ where: { userId } });
    if (!agent)
      throw new BadRequestException('Tu usuario no tiene perfil de agente.');
    if (followUp.agentId !== agent.id)
      throw new ForbiddenException(
        'Solo puedes modificar tus propios seguimientos.',
      );
  }
  private async assertPatients(
    manager: EntityManager | undefined,
    ...ids: string[]
  ) {
    const patients = manager?.getRepository(Patient) ?? this.patients;
    for (const id of ids)
      if (!(await patients.existsBy({ id })))
        throw new NotFoundException('No se encontró el paciente.');
  }

  /**
   * The API keeps `interlocutorId` as "the patient or one of their linked
   * companions"; it is stored as the companion id, or null for the patient.
   */
  private async resolveInterlocutor(
    subjectPatientId: string,
    interlocutorId: string | undefined,
    manager?: EntityManager,
  ): Promise<string | null> {
    if (!interlocutorId || subjectPatientId === interlocutorId) return null;
    const links =
      manager?.getRepository(CompanionPatient) ??
      this.dataSource.getRepository(CompanionPatient);
    const linked = await links.existsBy({
      patientId: subjectPatientId,
      companionId: interlocutorId,
    });
    if (!linked)
      throw new BadRequestException(
        'El interlocutor debe ser el paciente o un acompañante vinculado.',
      );
    return interlocutorId;
  }
}

/** API view of who was talked to: the companion, or the patient themself. */
export function interlocutorIdOf(
  followUp: Pick<FollowUp, 'interlocutorCompanionId' | 'subjectPatientId'>,
): string {
  return followUp.interlocutorCompanionId ?? followUp.subjectPatientId;
}

function withoutInterlocutor<T extends { interlocutorId?: string }>(
  input: T,
): Omit<T, 'interlocutorId'> {
  const { interlocutorId: _interlocutorId, ...rest } = input;
  return rest;
}
