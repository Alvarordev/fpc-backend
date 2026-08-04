import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { FollowUpStatus } from '../database/entities/follow-up.enums';
import { FollowUp } from '../database/entities/follow-up.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Reminder } from '../database/entities/reminder.entity';
import { ReminderStatus } from '../database/entities/reminder-status.enum';
import { CreateFollowUpDto, UpdateFollowUpDto } from './follow-ups.dto';
import { CreateReminderDto } from '../reminders/reminders.dto';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import { PatientAccessService } from '../patient-access/patient-access.service';
import { User } from '../database/entities/user.entity';
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
  async findOne(id: string, manager?: EntityManager) {
    const item = await (
      manager?.getRepository(FollowUp) ?? this.followUps
    ).findOne({ where: { id } });
    if (!item) throw new NotFoundException('Follow-up not found');
    return item;
  }
  async findOneForUser(id: string, user: User) {
    const item = await this.findOne(id);
    await this.access.assertCanRead(item.subjectPatientId, user);
    return item;
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
    Object.assign(
      item,
      input,
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
}
