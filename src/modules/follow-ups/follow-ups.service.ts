import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../../database/entities/follow-up.enums';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Reminder } from '../../database/entities/reminder.entity';
import { ReminderStatus } from '../../database/entities/reminder-status.enum';
import { CompanionPatient } from '../../database/entities/companion-patient.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { FindFollowUpsQueryDto } from './dto/list-follow-ups.dto';
import { UpdateFollowUpDto } from './dto/update-follow-up.dto';
import { CreateFollowUpsBatchDto } from './dto/create-follow-ups-batch.dto';
import { CreateReminderDto } from '../reminders/dto/create-reminder.dto';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import { PatientAccessService } from '../patients/access/patient-access.service';
import { User } from '../../database/entities/user.entity';
@Injectable()
export class FollowUpsService {
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
        interlocutorId: patientId,
        agentId,
        type: FollowUpType.IN_PERSON,
        status: FollowUpStatus.COMPLETED,
        purpose: FollowUpPurpose.FOLLOW_UP,
        scheduledAt: null,
        completedAt: new Date(),
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
  ) {
    await this.assertPatients(
      manager,
      input.subjectPatientId,
      input.interlocutorId,
    );
    await this.assertInterlocutor(
      input.subjectPatientId,
      input.interlocutorId,
      manager,
    );
    const agents = manager?.getRepository(Agent) ?? this.agents;
    const followUps = manager?.getRepository(FollowUp) ?? this.followUps;
    const agentId = await this.resolveAgentId(
      input.agentId,
      userId,
      userRole,
      agents,
    );
    const followUp = await followUps.save(
      followUps.create({
        ...input,
        agentId,
        status: this.inferStatus(input),
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
      }),
    );
    await this.invalidations.markDirty(followUp.subjectPatientId, manager);
    return followUp;
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
        'All follow-ups in a batch must belong to the same patient',
      );
    }

    const now = Date.now();
    for (const followUp of input.followUps) {
      const scheduledAt = followUp.scheduledAt
        ? new Date(followUp.scheduledAt).getTime()
        : Number.NaN;
      if (!Number.isFinite(scheduledAt) || scheduledAt <= now) {
        throw new BadRequestException(
          'Batch follow-ups must have a future scheduledAt and cannot be completed',
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
            'Batch follow-ups must have a future scheduledAt and cannot be completed',
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
    if (!item) throw new NotFoundException('Follow-up not found');
    return item;
  }
  async findOneForUser(id: string, user: User) {
    const item = await this.findOne(id);
    await this.access.assertCanRead(item.subjectPatientId, user);
    return item;
  }
  async findAllForUser(queryInput: FindFollowUpsQueryDto, user: User) {
    const query = this.followUps
      .createQueryBuilder('follow_up')
      .leftJoinAndSelect('follow_up.subjectPatient', 'subject_patient')
      .orderBy('follow_up.scheduled_at', 'ASC')
      .addOrderBy('follow_up.created_at', 'DESC');

    if (user.role === UserRole.AGENT) {
      const agent = await this.agents.findOne({ where: { userId: user.id } });
      if (!agent)
        throw new BadRequestException(
          'Authenticated user has no agent profile',
        );
      query.andWhere('follow_up.agent_id = :agentId', { agentId: agent.id });
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
          interlocutorId: input.interlocutorId ?? current.interlocutorId,
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
      await this.assertInterlocutor(
        item.subjectPatientId,
        input.interlocutorId,
      );
    Object.assign(
      item,
      input,
      input.scheduledAt ? { scheduledAt: new Date(input.scheduledAt) } : {},
      input.completedAt ? { completedAt: new Date(input.completedAt) } : {},
    );
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
    userId: string,
    userRole: string,
  ) {
    const followUp = await this.findOne(id);
    await this.assertWriteScope(followUp, userId, userRole);
    const assignedAgentId = await this.resolveAgentId(
      input.assignedAgentId,
      userId,
      userRole,
      this.agents,
    );
    return this.reminders.save(
      this.reminders.create({
        ...input,
        subjectPatientId: followUp.subjectPatientId,
        createdFromFollowUpId: id,
        assignedAgentId,
        dueAt: new Date(input.dueAt),
        status: ReminderStatus.PENDING,
      }),
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
        throw new BadRequestException(
          'Authenticated user has no agent profile',
        );
      if (requestedAgentId && requestedAgentId !== agent.id)
        throw new ForbiddenException(
          'Agents cannot assign follow-ups to others',
        );
      return agent.id;
    }
    if (!requestedAgentId) throw new BadRequestException('agentId is required');
    if (!(await agents.existsBy({ id: requestedAgentId })))
      throw new NotFoundException('Agent not found');
    return requestedAgentId;
  }
  private async assertWriteScope(
    followUp: FollowUp,
    userId: string,
    userRole: string,
    manager?: EntityManager,
  ) {
    if (userRole !== 'AGENT') return;
    const agents = manager?.getRepository(Agent) ?? this.agents;
    const agent = await agents.findOne({ where: { userId } });
    if (!agent)
      throw new BadRequestException('Authenticated user has no agent profile');
    if (followUp.agentId !== agent.id)
      throw new ForbiddenException(
        'Agents can only modify their own follow-ups',
      );
  }
  private async assertPatients(
    manager: EntityManager | undefined,
    ...ids: string[]
  ) {
    const patients = manager?.getRepository(Patient) ?? this.patients;
    const count = await patients.countBy({ id: ids[0] });
    for (const id of ids)
      if (!(await patients.existsBy({ id })))
        throw new NotFoundException('Patient not found');
    return count;
  }

  private async assertInterlocutor(
    subjectPatientId: string,
    interlocutorId: string,
    manager?: EntityManager,
  ) {
    if (subjectPatientId === interlocutorId) return;
    const links =
      manager?.getRepository(CompanionPatient) ??
      this.dataSource.getRepository(CompanionPatient);
    const linked = await links.existsBy({
      patientId: subjectPatientId,
      companionId: interlocutorId,
    });
    if (!linked)
      throw new BadRequestException(
        'Interlocutor must be the patient or a linked companion',
      );
  }
}
