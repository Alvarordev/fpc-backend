import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { InteractionStatus } from '../database/entities/interaction.enums';
import { Interaction } from '../database/entities/interaction.entity';
import { Patient } from '../database/entities/patient.entity';
import { Reminder } from '../database/entities/reminder.entity';
import { ReminderStatus } from '../database/entities/reminder-status.enum';
import { CreateInteractionDto, UpdateInteractionDto } from './interactions.dto';
import { CreateReminderDto } from '../reminders/reminders.dto';
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
  async create(input: CreateInteractionDto, userId: string, userRole: string) {
    await this.assertPatients(input.subjectPatientId, input.interlocutorId);
    let agentId = input.agentId ?? null;
    if (userRole === 'AGENT') {
      const agent = await this.agents.findOne({ where: { userId } });
      if (!agent)
        throw new BadRequestException(
          'Authenticated user has no agent profile',
        );
      agentId = agent.id;
    }
    return this.interactions.save(
      this.interactions.create({
        ...input,
        agentId,
        status: this.inferStatus(input),
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
      }),
    );
  }
  async findOne(id: string) {
    const item = await this.interactions.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Interaction not found');
    return item;
  }
  async scheduleNext(
    id: string,
    input: CreateInteractionDto,
    userId: string,
    role: string,
  ) {
    return this.dataSource.transaction(async () => {
      const current = await this.findOne(id);
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
      );
      current.nextInteractionId = next.id;
      await this.interactions.save(current);
      return next;
    });
  }
  async update(id: string, input: UpdateInteractionDto) {
    const item = await this.findOne(id);
    Object.assign(
      item,
      input,
      input.completedAt ? { completedAt: new Date(input.completedAt) } : {},
    );
    return this.interactions.save(item);
  }
  async createReminder(
    id: string,
    input: Omit<
      CreateReminderDto,
      'subjectPatientId' | 'createdFromInteractionId'
    >,
  ) {
    const interaction = await this.findOne(id);
    return this.reminders.save(
      this.reminders.create({
        ...input,
        subjectPatientId: interaction.subjectPatientId,
        createdFromInteractionId: id,
        dueAt: new Date(input.dueAt),
        status: ReminderStatus.PENDING,
      }),
    );
  }
  private async assertPatients(...ids: string[]) {
    const count = await this.patients.countBy({ id: ids[0] });
    for (const id of ids)
      if (!(await this.patients.existsBy({ id })))
        throw new NotFoundException('Patient not found');
    return count;
  }
}
