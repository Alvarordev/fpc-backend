import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ReminderStatus } from '../database/entities/reminder-status.enum';
import { Reminder } from '../database/entities/reminder.entity';
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
  ) {}
  create(input: CreateReminderDto) {
    return this.repository.save(
      this.repository.create({ ...input, dueAt: new Date(input.dueAt) }),
    );
  }
  async findOne(id: string) {
    const item = await this.repository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Reminder not found');
    return item;
  }
  async complete(id: string, input: CompleteReminderDto) {
    const item = await this.findOne(id);
    item.status = ReminderStatus.DONE;
    item.completedAt = new Date();
    item.resultingInteractionId = input.resultingInteractionId ?? null;
    return this.repository.save(item);
  }
  async dismiss(id: string) {
    const item = await this.findOne(id);
    item.status = ReminderStatus.DISMISSED;
    return this.repository.save(item);
  }
  async update(id: string, input: UpdateReminderDto) {
    const item = await this.findOne(id);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException('Closed reminders cannot be edited');
    Object.assign(
      item,
      input,
      input.dueAt ? { dueAt: new Date(input.dueAt) } : {},
    );
    return this.repository.save(item);
  }
  findAll() {
    return this.repository.find();
  }
  findMine(agentId: string) {
    return this.repository.find({
      where: [{ assignedAgentId: agentId }, { assignedAgentId: IsNull() }],
    });
  }
}
