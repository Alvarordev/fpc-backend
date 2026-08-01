import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { InteractionStatus } from '../database/entities/interaction.enums';
import { Interaction } from '../database/entities/interaction.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Reminder } from '../database/entities/reminder.entity';
import { ReminderStatus } from '../database/entities/reminder-status.enum';
import { CreateInteractionDto, UpdateInteractionDto } from './interactions.dto';
import { CreateReminderDto } from '../reminders/reminders.dto';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(Interaction)
    private readonly interactions: Repository<Interaction>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectRepository(Reminder)
    private readonly reminders: Repository<Reminder>,
    private readonly dataSource: DataSource,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}
  inferStatus(
    input: Pick<CreateInteractionDto, 'scheduledAt' | 'completedAt'>,
  ): InteractionStatus {
    return input.completedAt
      ? InteractionStatus.COMPLETED
      : input.scheduledAt && new Date(input.scheduledAt) > new Date()
        ? InteractionStatus.SCHEDULED
        : InteractionStatus.COMPLETED;
  }
  async create(
    input: CreateInteractionDto,
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
    const interactions =
      manager?.getRepository(Interaction) ?? this.interactions;
    const agentId = await this.resolveAgentId(
      input.agentId,
      userId,
      userRole,
      agents,
    );
    const interaction = await interactions.save(
      interactions.create({
        ...input,
        agentId,
        status: this.inferStatus(input),
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
      }),
    );
    await this.invalidations.markDirty(interaction.subjectPatientId, manager);
    return interaction;
  }
  async findOne(id: string, manager?: EntityManager) {
    const item = await (
      manager?.getRepository(Interaction) ?? this.interactions
    ).findOne({ where: { id } });
    if (!item) throw new NotFoundException('Interaction not found');
    return item;
  }
  async findOneForUser(id: string, userId: string, userRole: string) {
    const item = await this.findOne(id);
    await this.assertScope(item, userId, userRole);
    return item;
  }
  async scheduleNext(
    id: string,
    input: CreateInteractionDto,
    userId: string,
    role: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.findOne(id, manager);
      await this.assertScope(current, userId, role, manager);
      const next = await this.create(
        {
          ...input,
          subjectPatientId: input.subjectPatientId ?? current.subjectPatientId,
          interlocutorId: input.interlocutorId ?? current.interlocutorId,
          scheduledAt:
            input.scheduledAt ?? new Date(Date.now() + 60000).toISOString(),
          completedAt: undefined,
        },
        userId,
        role,
        manager,
      );
      current.nextInteractionId = next.id;
      await manager.getRepository(Interaction).save(current);
      await this.invalidations.markDirty(current.subjectPatientId, manager);
      return next;
    });
  }
  async update(
    id: string,
    input: UpdateInteractionDto,
    userId: string,
    userRole: string,
  ) {
    const item = await this.findOne(id);
    await this.assertScope(item, userId, userRole);
    Object.assign(
      item,
      input,
      input.completedAt ? { completedAt: new Date(input.completedAt) } : {},
    );
    const interaction = await this.interactions.save(item);
    await this.invalidations.markDirty(interaction.subjectPatientId);
    return interaction;
  }
  async createReminder(
    id: string,
    input: Omit<
      CreateReminderDto,
      'subjectPatientId' | 'createdFromInteractionId'
    >,
    userId: string,
    userRole: string,
  ) {
    const interaction = await this.findOne(id);
    await this.assertScope(interaction, userId, userRole);
    const assignedAgentId = await this.resolveAgentId(
      input.assignedAgentId,
      userId,
      userRole,
      this.agents,
    );
    return this.reminders.save(
      this.reminders.create({
        ...input,
        subjectPatientId: interaction.subjectPatientId,
        createdFromInteractionId: id,
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
          'Agents cannot assign interactions to others',
        );
      return agent.id;
    }
    if (!requestedAgentId) throw new BadRequestException('agentId is required');
    if (!(await agents.existsBy({ id: requestedAgentId })))
      throw new NotFoundException('Agent not found');
    return requestedAgentId;
  }
  private async assertScope(
    interaction: Interaction,
    userId: string,
    userRole: string,
    manager?: EntityManager,
  ) {
    if (userRole !== 'AGENT') return;
    const agents = manager?.getRepository(Agent) ?? this.agents;
    const agent = await agents.findOne({ where: { userId } });
    if (!agent)
      throw new BadRequestException('Authenticated user has no agent profile');
    if (interaction.agentId !== agent.id)
      throw new ForbiddenException(
        'Agents can only access their own interactions',
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
