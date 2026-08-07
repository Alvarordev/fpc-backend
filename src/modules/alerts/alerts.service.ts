import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity';
import {
  Alert,
  AlertCategory,
  AlertSeverity,
  AlertStatus,
} from '../../database/entities/alert.entity';
import { AlertEventType } from '../../database/entities/alert-event.entity';
import { HealthCenter } from '../../database/entities/health-center.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../../database/entities/follow-up.enums';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { Patient } from '../../database/entities/patient.entity';
import { User } from '../../database/entities/user.entity';
import { CreateAlertDto, FindAlertsDto, UpdateAlertDto } from './alerts.dto';
import { PatientAccessService } from '../patients/access/patient-access.service';
import {
  AlertEventsService,
  RESOLVED_EVENT_TITLE,
  STATUS_CHANGED_EVENT_TITLE,
  createdEventDescription,
  createdEventTitle,
  derivedEventDescription,
  derivedEventTitle,
  resolvedEventDescription,
  statusChangedEventDescription,
} from './alert-events.service';
import { N8nTransactionalDispatchService } from '../../integrations/n8n/transactional-dispatch.service';
import {
  buildAlertaDerivarEnvelope,
  buildAlertaEnvelope,
  buildAlertaResueltaEnvelope,
} from '../../integrations/n8n/n8n-webhook.payloads';

const NON_NULLABLE_UPDATE_FIELDS = [
  'title',
  'description',
  'healthCenterId',
  'followUpId',
  'status',
  'underReview',
  'severity',
  'category',
] as const;

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
    private readonly events: AlertEventsService,
    private readonly webhooks: N8nTransactionalDispatchService,
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
      const ticketNumber = await this.nextTicketNumber(manager);
      const saved = await manager.getRepository(Alert).save(
        manager.getRepository(Alert).create({
          healthCenterId: input.healthCenterId,
          followUpId,
          createdById: agent.id,
          title: input.title,
          description: input.description,
          status: AlertStatus.ACTIVE,
          severity: input.severity ?? AlertSeverity.HIGH,
          category: input.category ?? AlertCategory.GENERAL,
          ticketNumber,
          resolvedAt: null,
          resolvedById: null,
          resolvedByUserId: null,
        }),
      );
      await this.events.record(
        saved.id,
        agent.id,
        AlertEventType.CREATED,
        createdEventTitle(ticketNumber),
        createdEventDescription(agent.fullName, input.title),
        manager,
      );

      const snapshot = await this.loadWebhookSnapshot(
        manager,
        saved.followUpId,
        saved.healthCenterId,
      );
      await this.webhooks.enqueue(
        buildAlertaEnvelope({
          ticketNumber,
          patientFullName: snapshot.patient.fullName,
          patientDni: snapshot.patient.dni ?? '',
          patientPhone: snapshot.patient.primaryPhone,
          title: saved.title,
          description: saved.description,
          healthCenterName: snapshot.healthCenter.name,
          severity: saved.severity,
        }),
        manager,
      );
      return saved;
    });
    return this.findOne(alert.id, user);
  }

  // Reused wherever a webhook payload needs the alert's patient and health
  // center by id — separate from `baseQuery()` so the pessimistic-write
  // lock queries don't have to join across tables.
  private async loadWebhookSnapshot(
    manager: DataSource['manager'],
    followUpId: string,
    healthCenterId: string,
  ) {
    const followUp = await manager.getRepository(FollowUp).findOneOrFail({
      where: { id: followUpId },
      relations: { subjectPatient: true },
    });
    const healthCenter = await manager
      .getRepository(HealthCenter)
      .findOneOrFail({ where: { id: healthCenterId } });
    return { patient: followUp.subjectPatient, healthCenter };
  }

  private async nextTicketNumber(manager: DataSource['manager']) {
    const rows = await manager.query<{ seq: string }[]>(
      `SELECT nextval('alert_ticket_seq') AS seq`,
    );
    return `ALT-${new Date().getFullYear()}-${rows[0].seq}`;
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
    if (filters.severity)
      query.andWhere('alert.severity = :severity', {
        severity: filters.severity,
      });
    if (filters.category)
      query.andWhere('alert.category = :category', {
        category: filters.category,
      });
    if (filters.underReview !== undefined)
      query.andWhere('alert.under_review = :underReview', {
        underReview: filters.underReview,
      });
    if (filters.ticketNumber)
      query.andWhere('alert.ticket_number = :ticketNumber', {
        ticketNumber: filters.ticketNumber,
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
    // Ensure the alert is visible to this user (health-center/volunteer
    // scoping) before taking a row lock on it.
    await this.findOne(id, user);

    let agent: Agent | null = null;
    if (user.role === UserRole.AGENT) {
      agent = await this.agents.findOne({ where: { userId: user.id } });
      if (!agent)
        throw new BadRequestException(
          'Authenticated user has no agent profile',
        );
    }

    const alertId = await this.dataSource.transaction(async (manager) => {
      const alert = await manager
        .getRepository(Alert)
        .createQueryBuilder('alert')
        .setLock('pessimistic_write')
        .where('alert.id = :id', { id })
        .getOne();
      if (!alert) throw new NotFoundException('Alert not found');
      if (alert.status === AlertStatus.RESOLVED)
        throw new ConflictException('Alert is already resolved');

      alert.status = AlertStatus.RESOLVED;
      alert.resolvedAt = new Date();
      if (agent) {
        alert.resolvedById = agent.id;
        alert.resolvedByUserId = null;
      } else {
        alert.resolvedById = null;
        alert.resolvedByUserId = user.id;
      }
      await manager.getRepository(Alert).save(alert);

      const resolverName = agent?.fullName ?? user.email;
      await this.events.record(
        alert.id,
        agent?.id ?? null,
        AlertEventType.RESOLVED,
        RESOLVED_EVENT_TITLE,
        resolvedEventDescription(resolverName),
        manager,
      );

      const snapshot = await this.loadWebhookSnapshot(
        manager,
        alert.followUpId,
        alert.healthCenterId,
      );
      await this.webhooks.enqueue(
        buildAlertaResueltaEnvelope({
          ticketNumber: alert.ticketNumber ?? '',
          patientFullName: snapshot.patient.fullName,
          patientDni: snapshot.patient.dni ?? '',
          patientPhone: snapshot.patient.primaryPhone,
          title: alert.title,
          description: alert.description,
          healthCenterName: snapshot.healthCenter.name,
          severity: alert.severity,
        }),
        manager,
      );
      return alert.id;
    });
    return this.findOne(alertId, user);
  }

  async update(id: string, input: UpdateAlertDto, user: User) {
    if (
      ![UserRole.ADMIN, UserRole.AGENT, UserRole.FOUNDATION].includes(user.role)
    )
      throw new ForbiddenException(
        'Administrator, agent, or foundation role required',
      );
    // Ensure the alert is visible to this user before locking it.
    await this.findOne(id, user);
    this.assertNoInvalidNulls(input);
    if (input.status === AlertStatus.RESOLVED)
      throw new BadRequestException(
        'Use PATCH /alerts/:id/resolve to resolve an alert',
      );

    const alertId = await this.dataSource.transaction(async (manager) => {
      const alert = await manager
        .getRepository(Alert)
        .createQueryBuilder('alert')
        .setLock('pessimistic_write')
        .where('alert.id = :id', { id })
        .getOne();
      if (!alert) throw new NotFoundException('Alert not found');

      const previousStatus = alert.status;
      const derivationFieldsUpdated =
        input.derivedTo !== undefined || input.derivationNotes !== undefined;

      // assertNoInvalidNulls already rejected `null` for every field below
      // except derivedTo/derivationNotes, so the `!` assertions here are safe.
      if (input.title !== undefined) alert.title = input.title!;
      if (input.description !== undefined)
        alert.description = input.description!;
      if (input.healthCenterId !== undefined) {
        if (!(await this.healthCenters.existsBy({ id: input.healthCenterId! })))
          throw new NotFoundException('Health center not found');
        alert.healthCenterId = input.healthCenterId!;
      }
      if (input.followUpId !== undefined) {
        alert.followUpId = await this.existingFollowUp(input.followUpId!);
      }
      if (input.underReview !== undefined)
        alert.underReview = input.underReview!;
      if (input.derivedTo !== undefined) alert.derivedTo = input.derivedTo;
      if (input.derivationNotes !== undefined)
        alert.derivationNotes = input.derivationNotes;
      if (input.severity !== undefined) alert.severity = input.severity!;
      if (input.category !== undefined) alert.category = input.category!;
      if (input.status !== undefined) alert.status = input.status!;

      await manager.getRepository(Alert).save(alert);

      if (input.status !== undefined && input.status !== previousStatus) {
        await this.events.record(
          alert.id,
          alert.createdById,
          AlertEventType.STATUS_CHANGED,
          STATUS_CHANGED_EVENT_TITLE,
          statusChangedEventDescription(previousStatus, alert.status),
          manager,
        );
      }
      if (derivationFieldsUpdated && alert.derivedTo) {
        await this.events.record(
          alert.id,
          alert.createdById,
          AlertEventType.DERIVED,
          derivedEventTitle(alert.derivedTo),
          derivedEventDescription(alert.derivationNotes),
          manager,
        );

        const snapshot = await this.loadWebhookSnapshot(
          manager,
          alert.followUpId,
          alert.healthCenterId,
        );
        await this.webhooks.enqueue(
          buildAlertaDerivarEnvelope({
            ticketNumber: alert.ticketNumber ?? '',
            patientFullName: snapshot.patient.fullName,
            patientDni: snapshot.patient.dni ?? '',
            patientPhone: snapshot.patient.primaryPhone,
            title: alert.title,
            derivedTo: alert.derivedTo,
            healthCenterName: snapshot.healthCenter.name,
            severity: alert.severity,
          }),
          manager,
        );
      }
      return alert.id;
    });
    return this.findOne(alertId, user);
  }

  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Administrator role required');
    // Enforces the same visibility rules as a read before allowing a delete.
    await this.findOne(id, user);
    await this.alerts.delete(id);
  }

  // Intentionally takes no `user` — this backs the public WhatsApp-bot
  // lookup, so there is no session to scope against. Never call this from
  // an authenticated path; use findOne there instead.
  async findByTicket(ticketNumber: string) {
    const alert = await this.baseQuery()
      .where('alert.ticket_number = :ticketNumber', { ticketNumber })
      .getOne();
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async findEvents(id: string, user: User) {
    await this.findOne(id, user);
    return this.events.findAll(id);
  }

  // Companion to findByTicket: the alert's existence was already
  // established by that public lookup, so no further visibility check runs.
  async findEventsForAlert(alertId: string) {
    return this.events.findAll(alertId);
  }

  async addEvent(
    id: string,
    input: { title: string; description?: string },
    user: User,
  ) {
    if (
      ![UserRole.ADMIN, UserRole.AGENT, UserRole.FOUNDATION].includes(user.role)
    )
      throw new ForbiddenException(
        'Administrator, agent, or foundation role required',
      );
    const alert = await this.findOne(id, user);
    const agent = await this.agents.findOne({ where: { userId: user.id } });
    return this.events.record(
      alert.id,
      agent?.id ?? null,
      AlertEventType.COMMENT,
      input.title,
      input.description ?? null,
    );
  }

  private assertNoInvalidNulls(input: UpdateAlertDto): void {
    for (const field of NON_NULLABLE_UPDATE_FIELDS) {
      if (input[field] === null)
        throw new BadRequestException(`${field} cannot be null`);
    }
  }

  private baseQuery() {
    return this.alerts
      .createQueryBuilder('alert')
      .innerJoinAndSelect('alert.followUp', 'follow_up')
      .leftJoinAndSelect('follow_up.subjectPatient', 'subject_patient')
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
