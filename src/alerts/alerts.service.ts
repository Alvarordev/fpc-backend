import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { Alert, AlertStatus } from '../database/entities/alert.entity';
import { HealthCenter } from '../database/entities/health-center.entity';
import {
  InteractionPurpose,
  InteractionStatus,
  InteractionType,
} from '../database/entities/interaction.enums';
import { Interaction } from '../database/entities/interaction.entity';
import { Patient } from '../database/entities/patient.entity';
import { User } from '../database/entities/user.entity';
import { CreateAlertDto } from './alerts.dto';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectRepository(HealthCenter)
    private readonly healthCenters: Repository<HealthCenter>,
    @InjectRepository(Interaction)
    private readonly interactions: Repository<Interaction>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    private readonly dataSource: DataSource,
  ) {}

  async create(input: CreateAlertDto, user: User) {
    const agent = await this.agents.findOne({ where: { userId: user.id } });
    if (!agent)
      throw new BadRequestException('Authenticated user has no agent profile');
    if (!(await this.healthCenters.existsBy({ id: input.healthCenterId })))
      throw new NotFoundException('Health center not found');

    return this.dataSource.transaction(async (manager) => {
      const interactionId = input.interactionId
        ? await this.existingInteraction(input.interactionId)
        : await this.createInteraction(input, agent.id, manager);
      return manager.getRepository(Alert).save(
        manager.getRepository(Alert).create({
          healthCenterId: input.healthCenterId,
          interactionId,
          createdById: agent.id,
          title: input.title,
          description: input.description,
          status: AlertStatus.ACTIVE,
          resolvedAt: null,
          resolvedById: null,
        }),
      );
    });
  }

  findAll() {
    return this.alerts.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const alert = await this.alerts.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async resolve(id: string, user: User) {
    const agent = await this.agents.findOne({ where: { userId: user.id } });
    if (!agent)
      throw new BadRequestException('Authenticated user has no agent profile');
    const alert = await this.findOne(id);
    if (alert.status === AlertStatus.RESOLVED)
      throw new ConflictException('Alert is already resolved');
    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    alert.resolvedById = agent.id;
    return this.alerts.save(alert);
  }

  private async existingInteraction(id: string) {
    if (!(await this.interactions.existsBy({ id })))
      throw new NotFoundException('Interaction not found');
    return id;
  }

  private async createInteraction(
    input: CreateAlertDto,
    agentId: string,
    manager: DataSource['manager'],
  ) {
    if (!input.subjectPatientId)
      throw new BadRequestException(
        'subjectPatientId is required when interactionId is not provided',
      );
    const interlocutorId = input.interlocutorId ?? input.subjectPatientId;
    const patientCount = await manager.getRepository(Patient).count({
      where: [{ id: input.subjectPatientId }, { id: interlocutorId }],
    });
    if (patientCount !== (interlocutorId === input.subjectPatientId ? 1 : 2))
      throw new NotFoundException('Patient not found');

    const interaction = await manager.getRepository(Interaction).save(
      manager.getRepository(Interaction).create({
        subjectPatientId: input.subjectPatientId,
        interlocutorId,
        agentId,
        type: input.interactionType ?? InteractionType.IN_PERSON,
        status: InteractionStatus.COMPLETED,
        purpose: InteractionPurpose.OTHER,
        scheduledAt: null,
        completedAt: new Date(),
        notes: input.interactionNotes ?? null,
        nextInteractionId: null,
      }),
    );
    return interaction.id;
  }
}
