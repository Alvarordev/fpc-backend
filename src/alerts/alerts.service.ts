import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { Alert, AlertStatus } from '../database/entities/alert.entity';
import { HealthCenter } from '../database/entities/health-center.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../database/entities/follow-up.enums';
import { FollowUp } from '../database/entities/follow-up.entity';
import { UserRole } from '../database/entities/user-role.enum';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../database/entities/user.entity';
import { CreateAlertDto, FindAlertsDto } from './alerts.dto';
import { PatientAccessService } from '../patient-access/patient-access.service';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectRepository(HealthCenter)
    private readonly healthCenters: Repository<HealthCenter>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    private readonly dataSource: DataSource,
    private readonly access: PatientAccessService,
  ) {}

  async create(input: CreateAlertDto, user: User) {
    const agent = await this.agents.findOne({ where: { userId: user.id } });
    if (!agent)
      throw new BadRequestException('Authenticated user has no agent profile');
    if (!(await this.healthCenters.existsBy({ id: input.healthCenterId })))
      throw new NotFoundException('Health center not found');

    const alert = await this.dataSource.transaction(async (manager) => {
      const followUpId = input.followUpId
        ? await this.existingFollowUp(input.followUpId)
        : await this.createFollowUp(input, agent.id, manager);
      return manager.getRepository(Alert).save(
        manager.getRepository(Alert).create({
          healthCenterId: input.healthCenterId,
          followUpId,
          createdById: agent.id,
          title: input.title,
          description: input.description,
          status: AlertStatus.ACTIVE,
          resolvedAt: null,
          resolvedById: null,
          resolvedByUserId: null,
        }),
      );
    });
    return this.findOne(alert.id, user);
  }

  async findAll(filters: FindAlertsDto, user: User) {
    const query = this.baseQuery().orderBy('alert.created_at', 'DESC');
    if (filters.status)
      query.andWhere('alert.status = :status', { status: filters.status });
    if (filters.healthCenterId)
      query.andWhere('alert.health_center_id = :healthCenterId', {
        healthCenterId: filters.healthCenterId,
      });
    if (filters.createdById)
      query.andWhere('alert.created_by_id = :createdById', {
        createdById: filters.createdById,
      });
    await this.access.scopeQuery(query, 'follow_up.subject_patient_id', user);
    return query.getMany();
  }

  async findOne(id: string, user: User) {
    const query = this.baseQuery().where('alert.id = :id', { id });
    await this.access.scopeQuery(query, 'follow_up.subject_patient_id', user);
    const alert = await query.getOne();
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async resolve(id: string, user: User) {
    if (![UserRole.ADMIN, UserRole.AGENT].includes(user.role))
      throw new ForbiddenException('Administrator or agent role required');
    const alert = await this.findOne(id, user);
    if (alert.status === AlertStatus.RESOLVED)
      throw new ConflictException('Alert is already resolved');
    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    if (user.role === UserRole.AGENT) {
      const agent = await this.agents.findOne({ where: { userId: user.id } });
      if (!agent)
        throw new BadRequestException(
          'Authenticated user has no agent profile',
        );
      alert.resolvedById = agent.id;
      alert.resolvedByUserId = null;
    } else {
      alert.resolvedById = null;
      alert.resolvedByUserId = user.id;
    }
    await this.alerts.save(alert);
    return this.findOne(alert.id, user);
  }

  private baseQuery() {
    return this.alerts
      .createQueryBuilder('alert')
      .innerJoinAndSelect('alert.followUp', 'follow_up')
      .leftJoinAndSelect('alert.healthCenter', 'health_center')
      .leftJoinAndSelect('alert.createdBy', 'created_by')
      .leftJoinAndSelect('alert.resolvedBy', 'resolved_by')
      .leftJoinAndSelect('alert.resolvedByUser', 'resolved_by_user');
  }

  private async existingFollowUp(id: string) {
    if (!(await this.followUps.existsBy({ id })))
      throw new NotFoundException('Follow-up not found');
    return id;
  }

  private async createFollowUp(
    input: CreateAlertDto,
    agentId: string,
    manager: DataSource['manager'],
  ) {
    if (!input.subjectPatientId)
      throw new BadRequestException(
        'subjectPatientId is required when followUpId is not provided',
      );
    const interlocutorId = input.interlocutorId ?? input.subjectPatientId;
    const patientCount = await manager.getRepository(Patient).count({
      where: [{ id: input.subjectPatientId }, { id: interlocutorId }],
    });
    if (patientCount !== (interlocutorId === input.subjectPatientId ? 1 : 2))
      throw new NotFoundException('Patient not found');

    const followUp = await manager.getRepository(FollowUp).save(
      manager.getRepository(FollowUp).create({
        subjectPatientId: input.subjectPatientId,
        interlocutorId,
        agentId,
        type: input.followUpType ?? FollowUpType.IN_PERSON,
        status: FollowUpStatus.COMPLETED,
        purpose: FollowUpPurpose.OTHER,
        scheduledAt: null,
        completedAt: new Date(),
        notes: input.followUpNotes ?? null,
        nextFollowUpId: null,
      }),
    );
    return followUp.id;
  }
}
