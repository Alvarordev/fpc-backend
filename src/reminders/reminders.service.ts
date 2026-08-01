import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReminderStatus } from '../database/entities/reminder-status.enum';
import { Reminder } from '../database/entities/reminder.entity';
import { Agent } from '../database/entities/agent.entity';
import { Interaction } from '../database/entities/interaction.entity';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import {
  CreateReminderDto,
  CompleteReminderDto,
  UpdateReminderDto,
} from './reminders.dto';
@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Reminder)
    private readonly repository: Repository<Reminder>,
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectRepository(Interaction)
    private readonly interactions: Repository<Interaction>,
  ) {}
  async create(input: CreateReminderDto, user: User) {
    const assignedAgentId = await this.resolveAgentId(
      input.assignedAgentId,
      user,
    );
    return this.repository.save(
      this.repository.create({
        ...input,
        assignedAgentId,
        dueAt: new Date(input.dueAt),
      }),
    );
  }
  async findOne(id: string) {
    const item = await this.repository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Reminder not found');
    return item;
  }
  async complete(id: string, input: CompleteReminderDto, user: User) {
    const item = await this.findOne(id);
    await this.assertScope(item, user);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException('Only pending reminders can be completed');
    if (
      input.resultingInteractionId &&
      !(await this.interactions.existsBy({
        id: input.resultingInteractionId,
        subjectPatientId: item.subjectPatientId,
      }))
    )
      throw new BadRequestException(
        'Resulting interaction must belong to the reminder patient',
      );
    item.status = ReminderStatus.DONE;
    item.completedAt = new Date();
    item.resultingInteractionId = input.resultingInteractionId ?? null;
    return this.repository.save(item);
  }
  async dismiss(id: string, user: User) {
    const item = await this.findOne(id);
    await this.assertScope(item, user);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException('Only pending reminders can be dismissed');
    item.status = ReminderStatus.DISMISSED;
    return this.repository.save(item);
  }
  async update(id: string, input: UpdateReminderDto, user: User) {
    const item = await this.findOne(id);
    await this.assertScope(item, user);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException('Closed reminders cannot be edited');
    const assignedAgentId = input.assignedAgentId
      ? await this.resolveAgentId(input.assignedAgentId, user)
      : undefined;
    Object.assign(
      item,
      input,
      assignedAgentId ? { assignedAgentId } : {},
      input.dueAt ? { dueAt: new Date(input.dueAt) } : {},
    );
    return this.repository.save(item);
  }
  async findAll(user: User) {
    const agentId = await this.agentIdFor(user);
    return this.repository.find({
      where: agentId ? { assignedAgentId: agentId } : {},
    });
  }
  private async assertScope(item: Reminder, user: User) {
    const agentId = await this.agentIdFor(user);
    if (agentId && item.assignedAgentId !== agentId)
      throw new ForbiddenException(
        'Agents can only access their own reminders',
      );
  }
  private async agentIdFor(user: User) {
    if (user.role !== UserRole.AGENT) return null;
    const agent = await this.agents.findOne({ where: { userId: user.id } });
    if (!agent)
      throw new BadRequestException('Authenticated user has no agent profile');
    return agent.id;
  }
  private async resolveAgentId(
    requestedAgentId: string | undefined,
    user: User,
  ) {
    const agentId = await this.agentIdFor(user);
    if (agentId) {
      if (requestedAgentId && requestedAgentId !== agentId)
        throw new ForbiddenException('Agents cannot reassign reminders');
      return agentId;
    }
    if (!requestedAgentId)
      throw new BadRequestException('assignedAgentId is required');
    if (!(await this.agents.existsBy({ id: requestedAgentId })))
      throw new NotFoundException('Agent not found');
    return requestedAgentId;
  }
}
