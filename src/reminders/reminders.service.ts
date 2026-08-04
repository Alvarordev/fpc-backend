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
import { FollowUp } from '../database/entities/follow-up.entity';
import { Patient } from '../patients/entities/patient.entity';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import { PatientAccessService } from '../patient-access/patient-access.service';
import {
  CreateReminderDto,
  CompleteReminderDto,
  ListRemindersDto,
  UpdateReminderDto,
} from './reminders.dto';
@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Reminder)
    private readonly repository: Repository<Reminder>,
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    private readonly access: PatientAccessService,
  ) {}
  async create(input: CreateReminderDto, user: User) {
    const [assignedAgentId] = await Promise.all([
      this.resolveAgentId(input.assignedAgentId, user),
      this.assertCreateReferences(input),
    ]);
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
    await this.assertWriteScope(item, user);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException('Only pending reminders can be completed');
    if (
      input.resultingFollowUpId &&
      !(await this.followUps.existsBy({
        id: input.resultingFollowUpId,
        subjectPatientId: item.subjectPatientId,
      }))
    )
      throw new BadRequestException(
        'Resulting follow-up must belong to the reminder patient',
      );
    item.status = ReminderStatus.DONE;
    item.completedAt = new Date();
    item.resultingFollowUpId = input.resultingFollowUpId ?? null;
    return this.repository.save(item);
  }
  async dismiss(id: string, user: User) {
    const item = await this.findOne(id);
    await this.assertWriteScope(item, user);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException('Only pending reminders can be dismissed');
    item.status = ReminderStatus.DISMISSED;
    return this.repository.save(item);
  }
  async update(id: string, input: UpdateReminderDto, user: User) {
    const item = await this.findOne(id);
    await this.assertWriteScope(item, user);
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
  async findAll(filters: ListRemindersDto, user: User) {
    const query = this.repository.createQueryBuilder('reminder');
    await this.access.scopeQuery(query, 'reminder.subject_patient_id', user);
    if (filters.patientId)
      query.andWhere('reminder.subject_patient_id = :patientId', {
        patientId: filters.patientId,
      });
    return query.getMany();
  }
  private async assertCreateReferences(input: CreateReminderDto) {
    if (!(await this.patients.existsBy({ id: input.subjectPatientId })))
      throw new NotFoundException('Patient not found');
    if (
      input.createdFromFollowUpId &&
      !(await this.followUps.existsBy({
        id: input.createdFromFollowUpId,
        subjectPatientId: input.subjectPatientId,
      }))
    )
      throw new BadRequestException(
        'Source follow-up must belong to the reminder patient',
      );
  }
  private async assertWriteScope(item: Reminder, user: User) {
    const agentId = await this.agentIdFor(user);
    if (agentId && item.assignedAgentId !== agentId)
      throw new ForbiddenException(
        'Agents can only modify their own reminders',
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
