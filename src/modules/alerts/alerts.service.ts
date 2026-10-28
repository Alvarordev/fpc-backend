import { CompanionPatient } from '../../database/entities/companion-patient.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity';
import {
  Alert,
  AlertCategory,
  AlertSeverity,
  AlertStatus,
} from '../../database/entities/alert.entity';
import { AlertEventType } from '../../database/entities/alert-event.entity';
import { AlertReport } from '../../database/entities/alert-report.entity';
import { CatalogItem } from '../../database/entities/catalog-item.entity';
import { Foundation } from '../../database/entities/foundation.entity';
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
import { AlertFollowUpSourceDto, CreateAlertDto } from './dto/create-alert.dto';
import { FindAlertsDto } from './dto/list-alerts.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { ResolveAlertDto } from './dto/resolve-alert.dto';
import { DeriveAlertDto } from './dto/derive-alert.dto';
import { PatientAccessService } from '../patients/access/patient-access.service';
import {
  AlertActor,
  AlertEventsService,
  PATIENTS_NOTIFIED_EVENT_TITLE,
  RESOLVED_EVENT_TITLE,
  STATUS_CHANGED_EVENT_TITLE,
  createdEventDescription,
  createdEventTitle,
  derivedEventDescription,
  derivedEventTitle,
  reportLinkedEventTitle,
  resolvedEventDescription,
  statusChangedEventDescription,
} from './alert-events.service';
import { N8nTransactionalDispatchService } from '../../integrations/n8n/transactional-dispatch.service';
import {
  buildAlertaDerivarEnvelope,
  buildAlertaEnvelope,
  buildAlertaResueltaEnvelope,
} from '../../integrations/n8n/n8n-webhook.payloads';
import { CatalogValueService } from '../catalogs/catalog-value.service';
import { EmailService } from '../../integrations/email/email.service';
import {
  affectedPatientsMessage,
  foundationAlertMessage,
} from './alert-messages';

// Treatment situation of an ongoing treatment (formerly EN_CURSO).
const TREATMENT_IN_PROGRESS = 'EN_PROCESO';

const NON_NULLABLE_FIELD_LABELS: Record<string, string> = {
  title: 'el título',
  description: 'la descripción',
  healthCenterId: 'el establecimiento',
  status: 'el estado',
  severity: 'la severidad',
  category: 'la categoría',
};

const NON_NULLABLE_UPDATE_FIELDS = [
  'title',
  'description',
  'healthCenterId',
  'status',
  'severity',
  'category',
] as const;

export interface AffectedPatientRow {
  patientId: string;
  fullName: string;
  dni: string | null;
  phone: string | null;
  email: string | null;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
    @InjectRepository(AlertReport)
    private readonly reports: Repository<AlertReport>,
    @InjectRepository(HealthCenter)
    private readonly healthCenters: Repository<HealthCenter>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly access: PatientAccessService,
    private readonly events: AlertEventsService,
    private readonly webhooks: N8nTransactionalDispatchService,
    private readonly catalogValues: CatalogValueService,
    private readonly email: EmailService,
  ) {}

  async create(input: CreateAlertDto, user: User) {
    const actor = await this.events.actorFor(user);
    if (!actor.agentId)
      throw new BadRequestException('Tu usuario no tiene perfil de agente.');
    if (!(await this.healthCenters.existsBy({ id: input.healthCenterId })))
      throw new NotFoundException('No se encontró el establecimiento.');

    const alert = await this.dataSource.transaction(async (manager) => {
      const category = await this.catalogValues.resolve(
        'alert_category',
        input.category ?? AlertCategory.GENERAL,
        { manager },
      );
      const followUp = await this.resolveFollowUp(input, actor, manager);
      const ticketNumber = await this.nextTicketNumber(manager);
      const saved = await manager.getRepository(Alert).save(
        manager.getRepository(Alert).create({
          healthCenterId: input.healthCenterId,
          followUpId: followUp.id,
          createdById: actor.agentId!,
          title: input.title,
          description: input.description,
          status: AlertStatus.REPORTED,
          severity: input.severity ?? AlertSeverity.HIGH,
          category: category.code,
          ticketNumber,
          resolvedAt: null,
          resolvedByUserId: null,
        }),
      );
      await manager.getRepository(AlertReport).save(
        manager.getRepository(AlertReport).create({
          alertId: saved.id,
          patientId: followUp.subjectPatientId,
          followUpId: followUp.id,
          reportedByUserId: user.id,
        }),
      );
      await this.events.record(
        saved.id,
        actor,
        AlertEventType.CREATED,
        createdEventTitle(ticketNumber),
        createdEventDescription(actor.name, input.title),
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
    const created = await this.findOne(alert.id, user);
    void this.notifyFoundation(created);
    return created;
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
    if (filters.patientId)
      query.andWhere(
        'EXISTS (SELECT 1 FROM alert_reports r WHERE r.alert_id = alert.id AND r.patient_id = :patientId)',
        { patientId: filters.patientId },
      );
    if (filters.ticketNumber)
      query.andWhere('alert.ticket_number = :ticketNumber', {
        ticketNumber: filters.ticketNumber,
      });
    await this.access.scopeQuery(query, 'follow_up.subject_patient_id', user);
    return this.withReportCounts(await query.getMany());
  }

  private async withReportCounts(alerts: Alert[]) {
    if (alerts.length === 0) return alerts;
    const rows = await this.dataSource.query<{ id: string; n: string }[]>(
      `SELECT alert_id AS id, COUNT(*) AS n FROM alert_reports
        WHERE alert_id = ANY($1::uuid[]) GROUP BY alert_id`,
      [alerts.map((alert) => alert.id)],
    );
    const counts = new Map(rows.map((row) => [row.id, Number(row.n)]));
    for (const alert of alerts) alert.reportsCount = counts.get(alert.id) ?? 0;
    return alerts;
  }

  async findOne(id: string, user: User) {
    const query = this.baseQuery().where('alert.id = :id', { id });
    await this.access.scopeQuery(query, 'follow_up.subject_patient_id', user);
    const alert = await query.getOne();
    if (!alert) throw new NotFoundException('No se encontró la alerta.');
    await this.withReportCounts([alert]);
    return alert;
  }

  async update(id: string, input: UpdateAlertDto, user: User) {
    await this.findOne(id, user);
    this.assertNoInvalidNulls(input);
    const actor = await this.events.actorFor(user);

    const alertId = await this.dataSource.transaction(async (manager) => {
      const alert = await this.lockOpenAlert(manager, id);
      const previousStatus = alert.status;

      if (input.title !== undefined) alert.title = input.title!;
      if (input.description !== undefined)
        alert.description = input.description!;
      if (input.healthCenterId !== undefined) {
        if (!(await this.healthCenters.existsBy({ id: input.healthCenterId! })))
          throw new NotFoundException('No se encontró el establecimiento.');
        alert.healthCenterId = input.healthCenterId!;
      }
      if (input.severity !== undefined) alert.severity = input.severity!;
      if (input.category !== undefined)
        alert.category = (
          await this.catalogValues.resolve('alert_category', input.category!, {
            manager,
          })
        ).code;
      if (input.status !== undefined) alert.status = input.status!;

      await manager.getRepository(Alert).save(alert);

      if (alert.status !== previousStatus)
        await this.events.record(
          alert.id,
          actor,
          AlertEventType.STATUS_CHANGED,
          STATUS_CHANGED_EVENT_TITLE,
          statusChangedEventDescription(previousStatus, alert.status),
          manager,
        );
      return alert.id;
    });
    return this.findOne(alertId, user);
  }

  async resolve(id: string, input: ResolveAlertDto, user: User) {
    if (user.role !== UserRole.FOUNDATION)
      throw new ForbiddenException(
        'Esta acción la puede hacer solo la fundación.',
      );
    await this.findOne(id, user);
    const actor = await this.events.actorFor(user);

    const alertId = await this.dataSource.transaction(async (manager) => {
      const alert = await this.lockOpenAlert(manager, id);
      const previousStatus = alert.status;
      alert.status = AlertStatus.RESOLVED;
      alert.resolvedAt = new Date();
      alert.resolvedByUserId = user.id;
      alert.resolutionNotes = input.resolutionNotes.trim();
      await manager.getRepository(Alert).save(alert);

      await this.events.record(
        alert.id,
        actor,
        AlertEventType.STATUS_CHANGED,
        STATUS_CHANGED_EVENT_TITLE,
        statusChangedEventDescription(previousStatus, alert.status),
        manager,
      );
      await this.events.record(
        alert.id,
        actor,
        AlertEventType.RESOLVED,
        RESOLVED_EVENT_TITLE,
        resolvedEventDescription(actor.name, alert.resolutionNotes),
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

  async derive(id: string, input: DeriveAlertDto, user: User) {
    await this.findOne(id, user);
    const actor = await this.events.actorFor(user);

    const alertId = await this.dataSource.transaction(async (manager) => {
      const alert = await this.lockOpenAlert(manager, id);
      const entity = await this.catalogValues.resolve(
        'alert_derivation_entity',
        input.entityCode,
        { manager },
      );
      alert.derivedTo = entity.code;
      alert.derivationNotes = input.notes.trim();
      alert.derivedAt = new Date();
      await manager.getRepository(Alert).save(alert);

      await this.events.record(
        alert.id,
        actor,
        AlertEventType.DERIVED,
        derivedEventTitle(entity.label),
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
          derivedTo: entity.label,
          healthCenterName: snapshot.healthCenter.name,
          severity: alert.severity,
        }),
        manager,
      );
      return alert.id;
    });
    return this.findOne(alertId, user);
  }

  async linkReport(id: string, input: AlertFollowUpSourceDto, user: User) {
    await this.findOne(id, user);
    const actor = await this.events.actorFor(user);

    const reportId = await this.dataSource.transaction(async (manager) => {
      const alert = await this.lockOpenAlert(manager, id);
      const followUp = await this.resolveFollowUp(input, actor, manager);
      const repository = manager.getRepository(AlertReport);
      if (
        await repository.existsBy({
          alertId: alert.id,
          followUpId: followUp.id,
        })
      )
        throw new ConflictException(
          'Ese seguimiento ya está vinculado a la alerta.',
        );
      const report = await repository.save(
        repository.create({
          alertId: alert.id,
          patientId: followUp.subjectPatientId,
          followUpId: followUp.id,
          reportedByUserId: user.id,
        }),
      );
      const patient = await manager
        .getRepository(Patient)
        .findOneByOrFail({ id: followUp.subjectPatientId });
      await this.events.record(
        alert.id,
        actor,
        AlertEventType.REPORT_LINKED,
        reportLinkedEventTitle(patient.fullName),
        null,
        manager,
      );
      return report.id;
    });
    return this.reports.findOneOrFail({
      where: { id: reportId },
      relations: { patient: true, reportedByUser: true },
    });
  }

  async findReports(id: string, user: User) {
    await this.findOne(id, user);
    return this.reports.find({
      where: { alertId: id },
      relations: { patient: true, reportedByUser: true },
      order: { reportedAt: 'ASC' },
    });
  }

  async affectedPatients(id: string, user: User) {
    const alert = await this.findOne(id, user);
    const patients = await this.dataSource.query<AffectedPatientRow[]>(
      `SELECT DISTINCT p.id AS "patientId", p.full_name AS "fullName",
              p.dni AS "dni", p.primary_phone AS "phone", p.email AS "email"
         FROM patient_treatments t
         JOIN patients p ON p.id = t.patient_id
        WHERE t.is_current = true
          AND t.treatment_situation = $2
          AND t.receiving_health_center_id = $1
          AND p.activity_status <> 'INACTIVE'
        ORDER BY "fullName"`,
      [alert.healthCenterId, TREATMENT_IN_PROGRESS],
    );
    const message = affectedPatientsMessage(alert, null);
    return {
      alert,
      response: {
        alertId: alert.id,
        healthCenterId: alert.healthCenterId,
        healthCenterName: alert.healthCenter.name,
        patients,
        subject: message.subject,
        text: message.text,
      },
    };
  }

  async notifyAffectedPatients(id: string, user: User) {
    const { alert, response } = await this.affectedPatients(id, user);
    const withEmail = response.patients.filter((patient) =>
      patient.email?.trim(),
    );
    let sent = 0;
    let failed = 0;
    for (const patient of withEmail) {
      const message = affectedPatientsMessage(alert, patient.fullName);
      const result = await this.email.send({
        to: patient.email!,
        subject: message.subject,
        text: message.text,
      });
      if (result.status === 'SENT') sent += 1;
      else failed += 1;
    }
    const actor = await this.events.actorFor(user);
    await this.events.record(
      alert.id,
      actor,
      AlertEventType.PATIENTS_NOTIFIED,
      PATIENTS_NOTIFIED_EVENT_TITLE,
      `Correo enviado a ${sent} de ${withEmail.length} paciente(s) con correo (${response.patients.length} con tratamiento en proceso en el hospital).`,
    );
    return {
      totalPatients: response.patients.length,
      withEmail: withEmail.length,
      sent,
      failed,
      emailEnabled: this.email.enabled,
    };
  }

  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException(
        'Esta acción la puede hacer solo un administrador.',
      );
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
    if (!alert) throw new NotFoundException('No se encontró la alerta.');
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
    const alert = await this.findOne(id, user);
    const actor = await this.events.actorFor(user);
    return this.events.record(
      alert.id,
      actor,
      AlertEventType.COMMENT,
      input.title,
      input.description ?? null,
    );
  }

  private async notifyFoundation(alert: Alert) {
    try {
      const recipients = await this.users.find({
        where: { role: UserRole.FOUNDATION, isActive: true },
        select: { id: true, email: true },
      });
      const message = foundationAlertMessage(alert);
      for (const recipient of recipients)
        await this.email.send({
          to: recipient.email,
          subject: message.subject,
          text: message.text,
        });
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Foundation notice failed',
      );
    }
  }

  private async lockOpenAlert(manager: EntityManager, id: string) {
    const alert = await manager
      .getRepository(Alert)
      .createQueryBuilder('alert')
      .setLock('pessimistic_write')
      .where('alert.id = :id', { id })
      .getOne();
    if (!alert) throw new NotFoundException('No se encontró la alerta.');
    if (alert.status === AlertStatus.RESOLVED)
      throw new ConflictException('La alerta ya está resuelta.');
    return alert;
  }

  // Reused wherever a webhook payload needs the alert's patient and health
  // center by id — separate from `baseQuery()` so the pessimistic-write
  // lock queries don't have to join across tables.
  private async loadWebhookSnapshot(
    manager: EntityManager,
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

  private async nextTicketNumber(manager: EntityManager) {
    const rows = await manager.query<{ seq: string }[]>(
      `SELECT nextval('alert_ticket_seq') AS seq`,
    );
    return `ALT-${new Date().getFullYear()}-${rows[0].seq}`;
  }

  private assertNoInvalidNulls(input: UpdateAlertDto): void {
    for (const field of NON_NULLABLE_UPDATE_FIELDS) {
      if (input[field] === null)
        throw new BadRequestException(
          `Completa ${NON_NULLABLE_FIELD_LABELS[field] ?? 'los datos obligatorios'}.`,
        );
    }
  }

  private baseQuery() {
    return this.alerts
      .createQueryBuilder('alert')
      .innerJoinAndSelect('alert.followUp', 'follow_up')
      .leftJoinAndSelect('follow_up.subjectPatient', 'subject_patient')
      .leftJoinAndSelect('alert.healthCenter', 'health_center')
      .leftJoinAndSelect('alert.createdBy', 'created_by')
      .leftJoinAndSelect('alert.resolvedByUser', 'resolved_by_user')
      .leftJoinAndMapOne(
        'alert.resolverAgent',
        Agent,
        'resolver_agent',
        'resolver_agent.user_id = alert.resolved_by_user_id',
      )
      .leftJoinAndMapOne(
        'alert.resolverFoundation',
        Foundation,
        'resolver_foundation',
        'resolver_foundation.user_id = alert.resolved_by_user_id',
      )
      .leftJoinAndMapOne(
        'alert.categoryItem',
        CatalogItem,
        'category_item',
        "category_item.kind = 'alert_category' AND category_item.code = alert.category",
      )
      .leftJoinAndMapOne(
        'alert.derivedToItem',
        CatalogItem,
        'derived_to_item',
        "derived_to_item.kind = 'alert_derivation_entity' AND derived_to_item.code = alert.derived_to",
      );
  }

  private async resolveFollowUp(
    input: AlertFollowUpSourceDto,
    actor: AlertActor,
    manager: EntityManager,
  ): Promise<{ id: string; subjectPatientId: string }> {
    if (input.followUpId) {
      const followUp = await manager.getRepository(FollowUp).findOne({
        where: { id: input.followUpId },
        select: { id: true, subjectPatientId: true },
      });
      if (!followUp)
        throw new NotFoundException('No se encontró el seguimiento.');
      return followUp;
    }
    if (!input.subjectPatientId)
      throw new BadRequestException(
        'subjectPatientId is required when followUpId is not provided',
      );
    if (!actor.agentId)
      throw new BadRequestException('Selecciona el seguimiento.');
    if (
      !(await manager
        .getRepository(Patient)
        .existsBy({ id: input.subjectPatientId }))
    )
      throw new NotFoundException('No se encontró el paciente.');
    const interlocutorCompanionId =
      input.interlocutorId && input.interlocutorId !== input.subjectPatientId
        ? input.interlocutorId
        : null;
    if (
      interlocutorCompanionId &&
      !(await manager.getRepository(CompanionPatient).existsBy({
        patientId: input.subjectPatientId,
        companionId: interlocutorCompanionId,
      }))
    )
      throw new BadRequestException(
        'El interlocutor debe ser el paciente o un acompañante vinculado.',
      );

    const followUp = await manager.getRepository(FollowUp).save(
      manager.getRepository(FollowUp).create({
        subjectPatientId: input.subjectPatientId,
        interlocutorCompanionId,
        agentId: actor.agentId,
        type: input.followUpType ?? FollowUpType.IN_PERSON,
        status: FollowUpStatus.COMPLETED,
        purpose: FollowUpPurpose.OTHER,
        scheduledAt: null,
        completedAt: new Date(),
        notes: input.followUpNotes ?? null,
        nextFollowUpId: null,
      }),
    );
    return { id: followUp.id, subjectPatientId: followUp.subjectPatientId };
  }
}
