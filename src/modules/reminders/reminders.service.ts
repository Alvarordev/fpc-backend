import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { MedicalAppointmentStatus } from '../../database/entities/medical-appointment-status.enum';
import { PatientMedicalAppointment } from '../../database/entities/patient-medical-appointment.entity';
import { ReminderKind } from '../../database/entities/reminder-kind.enum';
import { ReminderStatus } from '../../database/entities/reminder-status.enum';
import { Reminder } from '../../database/entities/reminder.entity';
import { Agent } from '../../database/entities/agent.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { Patient } from '../../database/entities/patient.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import {
  dateOnlyInLima,
  dateOnlyInLimaFromInput,
  isDateOnlyRangeValid,
} from '../../shared/date-only/date-only.util';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { HistoryVersioningService } from '../patients/history-versioning/history-versioning.service';
import { PatientAccessService } from '../patients/access/patient-access.service';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import {
  CompleteReminderDto,
  CompleteReminderMedicalAppointmentDto,
} from './dto/complete-reminder.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ListRemindersDto } from './dto/list-reminders.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import type {
  CreateHistoricalReminderDto,
  UpdateHistoricalReminderDto,
} from '../historical-records/dto/create-historical-reminder.dto';
import { normalizeReferralFields } from '../patients/clinical/medical-appointments/referral-fields';
import { HealthCenter } from '../../database/entities/health-center.entity';
import {
  ReminderChannel,
  ReminderDeliveryStatus,
  ReminderLead,
} from '../../database/entities/reminder-delivery.enums';
import { EmailService } from '../../integrations/email/email.service';
import { AuditContextService } from '../../shared/audit/audit-context.service';
import { AuditContextKind } from '../../shared/audit/audit-context';
import {
  computeRemindAt,
  createAppointmentReminder,
  DEFAULT_APPOINTMENT_REMINDER_LEAD,
  timeInLima,
} from './appointment-reminder';
import { buildReminderMessage } from './reminder-message';
import { CatalogValueService } from '../catalogs/catalog-value.service';

const DISPATCH_BATCH_SIZE = 50;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private dispatching = false;

  constructor(
    @InjectRepository(Reminder)
    private readonly repository: Repository<Reminder>,
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(PatientMedicalAppointment)
    private readonly appointments: Repository<PatientMedicalAppointment>,
    private readonly access: PatientAccessService,
    private readonly versioning: HistoryVersioningService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => FollowUpsService))
    private readonly followUpsService: FollowUpsService,
    private readonly email: EmailService,
    private readonly audit: AuditContextService,
    private readonly catalogValues: CatalogValueService,
  ) {}

  async create(input: CreateReminderDto, user: User) {
    const kind = input.kind ?? ReminderKind.GENERIC;
    if (
      kind === ReminderKind.MEDICAL_APPOINTMENT &&
      !input.medicalAppointment?.specialty?.trim()
    ) {
      throw new BadRequestException('Selecciona la especialidad de la cita.');
    }

    const [assignedAgentId] = await Promise.all([
      this.resolveAgentId(input.assignedAgentId, user),
      this.assertCreateReferences(input),
    ]);

    if (kind !== ReminderKind.MEDICAL_APPOINTMENT) {
      if (!input.description?.trim()) {
        throw new BadRequestException('Completa la descripción.');
      }
      if (input.lead)
        throw new BadRequestException(
          'La anticipación solo aplica a recordatorios de citas médicas.',
        );
      return this.repository.save(
        this.repository.create({
          subjectPatientId: input.subjectPatientId,
          createdFromFollowUpId: input.createdFromFollowUpId ?? null,
          assignedAgentId,
          dueAt: new Date(input.dueAt),
          dueOn: dateOnlyInLimaFromInput(input.dueAt),
          description: input.description.trim(),
          kind: ReminderKind.GENERIC,
          medicalAppointmentId: null,
          status: ReminderStatus.PENDING,
          completedOn: null,
          channel: input.channel ?? ReminderChannel.MANUAL,
          lead: null,
          remindAt: new Date(input.remindAt ?? input.dueAt),
          deliveryStatus: ReminderDeliveryStatus.PENDING,
          isHistorical: false,
        }),
      );
    }

    return this.createMedicalAppointmentReminder(input, assignedAgentId);
  }

  async findOne(id: string) {
    const item = await this.repository.findOne({
      where: { id },
      relations: {
        medicalAppointment: { healthCenter: true },
        subjectPatient: true,
      },
    });
    if (!item) throw new NotFoundException('No se encontró el recordatorio.');
    return item;
  }

  async createHistorical(
    input: CreateHistoricalReminderDto,
    historicalLoadedById: string,
  ) {
    this.assertHistoricalDateRange(input.dueOn, input.completedOn);
    const kind = input.kind ?? ReminderKind.GENERIC;
    if (kind === ReminderKind.GENERIC && !input.description.trim())
      throw new BadRequestException('Completa la descripción.');
    if (
      kind === ReminderKind.MEDICAL_APPOINTMENT &&
      !input.medicalAppointmentId &&
      !input.medicalAppointment?.specialty?.trim()
    )
      throw new BadRequestException(
        'El recordatorio histórico necesita su cita médica.',
      );
    if (input.status !== ReminderStatus.DONE && input.completedOn)
      throw new BadRequestException(
        'La fecha de realización solo aplica a recordatorios realizados.',
      );

    const saved = await this.dataSource.transaction(async (manager) => {
      const patients = manager.getRepository(Patient);
      const agents = manager.getRepository(Agent);
      const followUps = manager.getRepository(FollowUp);
      const appointments = manager.getRepository(PatientMedicalAppointment);

      if (!(await patients.existsBy({ id: input.subjectPatientId })))
        throw new NotFoundException('No se encontró el paciente.');
      if (!(await agents.existsBy({ id: input.assignedAgentId })))
        throw new NotFoundException('No se encontró el agente.');
      if (
        input.createdFromFollowUpId &&
        !(await followUps.existsBy({
          id: input.createdFromFollowUpId,
          subjectPatientId: input.subjectPatientId,
        }))
      )
        throw new BadRequestException(
          'El seguimiento de origen debe ser del mismo paciente.',
        );

      let medicalAppointmentId = input.medicalAppointmentId ?? null;
      if (input.medicalAppointmentId) {
        const appointment = await appointments.findOneBy({
          id: input.medicalAppointmentId,
          patientId: input.subjectPatientId,
        });
        if (!appointment)
          throw new BadRequestException(
            'La cita médica debe ser del mismo paciente del recordatorio.',
          );
      }

      if (
        kind === ReminderKind.MEDICAL_APPOINTMENT &&
        input.medicalAppointment &&
        !medicalAppointmentId
      ) {
        const appt = input.medicalAppointment;
        if (
          appt.healthCenterId &&
          !(await manager
            .getRepository(HealthCenter)
            .existsBy({ id: appt.healthCenterId }))
        )
          throw new NotFoundException('No se encontró el establecimiento.');
        const followUpId =
          input.createdFromFollowUpId ??
          (await this.followUpsService.resolveOrCreateForPatient(
            input.subjectPatientId,
            input.assignedAgentId,
            manager,
          ));
        const referral = normalizeReferralFields(appt);
        const appointment = await appointments.save(
          appointments.create({
            patientId: input.subjectPatientId,
            followUpId,
            healthCenterId: appt.healthCenterId ?? null,
            specialty: appt.specialty.trim(),
            appointmentDate: appt.appointmentDate ?? input.dueOn ?? null,
            appointmentTime: appt.appointmentTime ?? null,
            nextAppointmentDate: appt.nextAppointmentDate ?? null,
            nextAppointmentSpecialty: appt.nextAppointmentSpecialty ?? null,
            hasReferralSheet: referral.hasReferralSheet ?? null,
            referredTo: referral.referredTo ?? null,
            referralNotProvidedReason:
              referral.referralNotProvidedReason ?? null,
            difficulties: appt.difficulties ?? null,
            isFirstConsultation: appt.isFirstConsultation ?? false,
            status: appt.status,
            reminderId: null,
            attendedViaSepa: appt.attendedViaSepa ?? null,
            referredViaSepa: appt.referredViaSepa ?? null,
            isCurrent: false,
            isHistorical: true,
            historicalLoadedById,
            changeReason: appt.changeReason ?? null,
          }),
        );
        medicalAppointmentId = appointment.id;
      }

      const specialty =
        input.medicalAppointment?.specialty?.trim() ??
        (medicalAppointmentId
          ? (await appointments.findOneBy({ id: medicalAppointmentId }))
              ?.specialty
          : undefined);
      const description =
        input.description.trim() ||
        (specialty ? `Cita: ${specialty}` : 'Recordatorio histórico');

      const repository = manager.getRepository(Reminder);
      const reminder = await repository.save(
        repository.create({
          subjectPatientId: input.subjectPatientId,
          createdFromFollowUpId: input.createdFromFollowUpId ?? null,
          assignedAgentId: input.assignedAgentId,
          dueAt: null,
          dueOn: input.dueOn ?? null,
          description,
          kind,
          medicalAppointmentId,
          status: input.status,
          completedAt: null,
          completedOn: input.completedOn ?? null,
          isHistorical: true,
          historicalLoadedById,
        }),
      );

      if (medicalAppointmentId) {
        await appointments.update(
          { id: medicalAppointmentId },
          { reminderId: reminder.id },
        );
      }

      await this.invalidations.markDirty(input.subjectPatientId, manager);
      return reminder;
    });
    return this.findOne(saved.id);
  }

  async updateHistorical(
    id: string,
    input: UpdateHistoricalReminderDto,
    _userId: string,
  ) {
    const saved = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Reminder);
      const appointments = manager.getRepository(PatientMedicalAppointment);
      const item = await repository.findOne({
        where: { id },
        relations: { medicalAppointment: true },
      });
      if (!item) throw new NotFoundException('No se encontró el recordatorio.');
      if (!item.isHistorical)
        throw new BadRequestException(
          'Desde carga histórica solo se editan recordatorios históricos.',
        );

      if (input.assignedAgentId !== undefined) {
        if (
          !(await manager
            .getRepository(Agent)
            .existsBy({ id: input.assignedAgentId }))
        )
          throw new NotFoundException('No se encontró el agente.');
        item.assignedAgentId = input.assignedAgentId;
      }
      if (input.dueOn !== undefined) item.dueOn = input.dueOn;
      if (input.completedOn !== undefined) item.completedOn = input.completedOn;
      if (input.description !== undefined)
        item.description = input.description.trim();
      if (input.status !== undefined) item.status = input.status;
      if (input.createdFromFollowUpId !== undefined)
        item.createdFromFollowUpId = input.createdFromFollowUpId;

      if (item.status !== ReminderStatus.DONE && item.completedOn)
        throw new BadRequestException(
          'La fecha de realización solo aplica a recordatorios realizados.',
        );
      this.assertHistoricalDateRange(
        item.dueOn ?? undefined,
        item.completedOn ?? undefined,
      );

      if (input.medicalAppointment && item.medicalAppointmentId) {
        const appointment = await appointments.findOne({
          where: {
            id: item.medicalAppointmentId,
            patientId: item.subjectPatientId,
          },
        });
        if (!appointment)
          throw new NotFoundException(
            'No se encontró la cita médica vinculada.',
          );
        const referral = normalizeReferralFields(input.medicalAppointment);
        Object.assign(appointment, {
          specialty:
            input.medicalAppointment.specialty?.trim() ?? appointment.specialty,
          healthCenterId:
            input.medicalAppointment.healthCenterId !== undefined
              ? input.medicalAppointment.healthCenterId
              : appointment.healthCenterId,
          appointmentDate:
            input.medicalAppointment.appointmentDate !== undefined
              ? input.medicalAppointment.appointmentDate
              : appointment.appointmentDate,
          appointmentTime:
            input.medicalAppointment.appointmentTime !== undefined
              ? input.medicalAppointment.appointmentTime
              : appointment.appointmentTime,
          nextAppointmentDate:
            input.medicalAppointment.nextAppointmentDate !== undefined
              ? input.medicalAppointment.nextAppointmentDate
              : appointment.nextAppointmentDate,
          nextAppointmentSpecialty:
            input.medicalAppointment.nextAppointmentSpecialty !== undefined
              ? input.medicalAppointment.nextAppointmentSpecialty
              : appointment.nextAppointmentSpecialty,
          hasReferralSheet:
            referral.hasReferralSheet !== undefined
              ? referral.hasReferralSheet
              : appointment.hasReferralSheet,
          referredTo:
            referral.referredTo !== undefined
              ? referral.referredTo
              : appointment.referredTo,
          referralNotProvidedReason:
            referral.referralNotProvidedReason !== undefined
              ? referral.referralNotProvidedReason
              : appointment.referralNotProvidedReason,
          difficulties:
            input.medicalAppointment.difficulties !== undefined
              ? input.medicalAppointment.difficulties
              : appointment.difficulties,
          isFirstConsultation:
            input.medicalAppointment.isFirstConsultation !== undefined
              ? input.medicalAppointment.isFirstConsultation
              : appointment.isFirstConsultation,
          status: input.medicalAppointment.status ?? appointment.status,
          attendedViaSepa:
            input.medicalAppointment.attendedViaSepa !== undefined
              ? input.medicalAppointment.attendedViaSepa
              : appointment.attendedViaSepa,
          referredViaSepa:
            input.medicalAppointment.referredViaSepa !== undefined
              ? input.medicalAppointment.referredViaSepa
              : appointment.referredViaSepa,
          changeReason:
            input.medicalAppointment.changeReason !== undefined
              ? input.medicalAppointment.changeReason
              : appointment.changeReason,
        });
        await appointments.save(appointment);
      } else if (
        input.medicalAppointment &&
        item.kind === ReminderKind.MEDICAL_APPOINTMENT &&
        !item.medicalAppointmentId
      ) {
        throw new BadRequestException(
          'Al recordatorio histórico le falta su cita médica.',
        );
      }

      const reminder = await repository.save(item);
      await this.invalidations.markDirty(reminder.subjectPatientId, manager);
      return reminder;
    });
    return this.findOne(saved.id);
  }

  async complete(id: string, input: CompleteReminderDto, user: User) {
    const item = await this.findOne(id);
    await this.assertWriteScope(item, user);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException(
        'Solo se puede completar un recordatorio pendiente.',
      );

    if (item.kind === ReminderKind.MEDICAL_APPOINTMENT) {
      if (!input.medicalAppointment) {
        throw new BadRequestException(
          'Para completar el recordatorio, registra el resultado de la cita.',
        );
      }
      if (!item.medicalAppointmentId) {
        throw new BadRequestException(
          'Al recordatorio le falta su cita médica.',
        );
      }
      await this.applyAppointmentCompletion(item, input.medicalAppointment);
    }

    item.status = ReminderStatus.DONE;
    item.completedAt = new Date();
    item.completedOn = dateOnlyInLima(new Date());
    const saved = await this.repository.save(item);
    return this.findOne(saved.id);
  }

  async dismiss(id: string, user: User) {
    const item = await this.findOne(id);
    await this.assertWriteScope(item, user);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException(
        'Solo se puede descartar un recordatorio pendiente.',
      );

    if (
      item.kind === ReminderKind.MEDICAL_APPOINTMENT &&
      item.medicalAppointmentId
    ) {
      await this.cancelLinkedAppointment(item, 'Recordatorio descartado');
    }

    item.status = ReminderStatus.DISMISSED;
    const saved = await this.repository.save(item);
    return this.findOne(saved.id);
  }

  async update(id: string, input: UpdateReminderDto, user: User) {
    const item = await this.findOne(id);
    await this.assertWriteScope(item, user);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException(
        'No se puede editar un recordatorio cerrado.',
      );
    const assignedAgentId = input.assignedAgentId
      ? await this.resolveAgentId(input.assignedAgentId, user)
      : undefined;

    if (input.dueAt) {
      item.dueAt = new Date(input.dueAt);
      item.dueOn = dateOnlyInLimaFromInput(input.dueAt);
    }
    if (input.description !== undefined) item.description = input.description;
    if (assignedAgentId) item.assignedAgentId = assignedAgentId;
    if (input.channel) item.channel = input.channel;
    if (input.dueAt || input.lead || input.remindAt) {
      this.applySchedule(item, input);
      item.deliveryStatus = ReminderDeliveryStatus.PENDING;
      item.sentAt = null;
      item.deliveryError = null;
    }

    if (
      item.kind === ReminderKind.MEDICAL_APPOINTMENT &&
      item.medicalAppointmentId &&
      (input.dueAt || input.healthCenterId !== undefined)
    ) {
      await this.syncLinkedAppointmentSchedule(item, input);
    }

    const saved = await this.repository.save(item);
    return this.findOne(saved.id);
  }

  async findAll(filters: ListRemindersDto, user: User) {
    const query = this.repository
      .createQueryBuilder('reminder')
      .leftJoinAndSelect('reminder.medicalAppointment', 'medicalAppointment')
      .leftJoinAndSelect('medicalAppointment.healthCenter', 'healthCenter');
    query
      .orderBy('reminder.due_on', 'ASC', 'NULLS LAST')
      .addOrderBy('reminder.due_at', 'ASC', 'NULLS LAST')
      .addOrderBy('reminder.created_at', 'DESC')
      .addOrderBy('reminder.id', 'DESC');
    await this.access.scopeQuery(query, 'reminder.subject_patient_id', user);
    const agentId = await this.agentIdFor(user);
    if (agentId)
      query.andWhere('reminder.assigned_agent_id = :reminderAgentId', {
        reminderAgentId: agentId,
      });
    if (filters.patientId)
      query.andWhere('reminder.subject_patient_id = :patientId', {
        patientId: filters.patientId,
      });
    return query.getMany();
  }

  private async createMedicalAppointmentReminder(
    input: CreateReminderDto,
    assignedAgentId: string,
  ) {
    const specialty = input.medicalAppointment!.specialty.trim();
    const dueAt = new Date(input.dueAt);
    if (dueAt <= new Date())
      throw new BadRequestException(
        'El recordatorio necesita una cita médica futura.',
      );
    const lead = input.lead ?? DEFAULT_APPOINTMENT_REMINDER_LEAD;
    computeRemindAt(dueAt, lead, input.remindAt);

    return this.dataSource.transaction(async (manager) => {
      const followUpId =
        input.createdFromFollowUpId ??
        (await this.followUpsService.resolveOrCreateForPatient(
          input.subjectPatientId,
          assignedAgentId,
          manager,
        ));

      const appointment = await this.versioning.replaceCurrent(
        PatientMedicalAppointment,
        {
          patientId: input.subjectPatientId,
          specialty,
          isCurrent: true,
        },
        {
          patientId: input.subjectPatientId,
          followUpId,
          specialty,
          healthCenterId: input.medicalAppointment!.healthCenterId ?? null,
          appointmentDate: dateOnlyInLimaFromInput(input.dueAt),
          appointmentTime: timeInLima(dueAt),
          isFirstConsultation:
            input.medicalAppointment!.isFirstConsultation ?? false,
          status: MedicalAppointmentStatus.SCHEDULED,
          reminderId: null,
          nextAppointmentDate: null,
          nextAppointmentSpecialty: null,
          hasReferralSheet: null,
          referredTo: null,
          referralNotProvidedReason: null,
          difficulties: null,
          attendedViaSepa: null,
          referredViaSepa: null,
          changeReason: null,
          isHistorical: false,
        },
        manager,
      );

      const reminder = await createAppointmentReminder(manager, appointment, {
        lead,
        remindAt: input.remindAt,
        channel: input.channel,
        description: input.description,
        assignedAgentId,
        createdFromFollowUpId: input.createdFromFollowUpId ?? null,
      });
      if (!reminder)
        throw new BadRequestException(
          'El recordatorio necesita una cita médica futura.',
        );

      await this.invalidations.markDirty(input.subjectPatientId, manager);
      return manager.getRepository(Reminder).findOneOrFail({
        where: { id: reminder.id },
        relations: {
          medicalAppointment: { healthCenter: true },
        },
      });
    });
  }

  private applySchedule(item: Reminder, input: UpdateReminderDto) {
    if (input.dueAt) {
      item.dueAt = new Date(input.dueAt);
      item.dueOn = dateOnlyInLimaFromInput(input.dueAt);
    }
    if (item.kind !== ReminderKind.MEDICAL_APPOINTMENT) {
      if (input.lead)
        throw new BadRequestException(
          'La anticipación solo aplica a recordatorios de citas médicas.',
        );
      item.remindAt = new Date(input.remindAt ?? item.dueAt ?? Date.now());
      return;
    }
    if (!item.dueAt)
      throw new BadRequestException(
        'El recordatorio de la cita médica necesita una fecha.',
      );
    const lead =
      input.lead ??
      (input.remindAt
        ? ReminderLead.CUSTOM
        : (item.lead ?? DEFAULT_APPOINTMENT_REMINDER_LEAD));
    const custom =
      input.remindAt ?? (lead === ReminderLead.CUSTOM ? item.remindAt : null);
    const remindAt = computeRemindAt(item.dueAt, lead, custom);
    const now = new Date();
    item.lead = lead;
    item.remindAt = remindAt < now ? now : remindAt;
  }

  async getMessage(id: string, user: User) {
    const item = await this.findOne(id);
    await this.access.assertCanRead(item.subjectPatientId, user);
    const message = await this.messageFor(item);
    return {
      reminderId: item.id,
      patientName: item.subjectPatient?.fullName ?? null,
      phone: item.subjectPatient?.primaryPhone ?? null,
      email: item.subjectPatient?.email ?? null,
      subject: message.subject,
      text: message.text,
      defaultText: message.defaultText,
      isCustom: Boolean(item.customMessage),
    };
  }

  /** Guarda el texto del correo; vacío vuelve al texto sugerido. */
  async setMessage(id: string, text: string | null | undefined, user: User) {
    const item = await this.findOne(id);
    await this.assertWriteScope(item, user);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException(
        'No se puede editar un recordatorio cerrado.',
      );
    item.customMessage = text?.trim() || null;
    await this.repository.update(item.id, {
      customMessage: item.customMessage,
    });
    return this.getMessage(id, user);
  }

  async sendEmail(id: string, user: User) {
    const item = await this.findOne(id);
    await this.assertWriteScope(item, user);
    if (item.status !== ReminderStatus.PENDING || item.isHistorical)
      throw new BadRequestException(
        'Solo se puede enviar un recordatorio pendiente.',
      );
    if (!item.subjectPatient?.email)
      throw new BadRequestException('El paciente no tiene correo registrado.');
    await this.deliver(item);
    return this.findOne(id);
  }

  async markSent(id: string, user: User) {
    const item = await this.findOne(id);
    await this.assertWriteScope(item, user);
    if (item.status !== ReminderStatus.PENDING || item.isHistorical)
      throw new BadRequestException(
        'Solo se puede marcar un recordatorio pendiente.',
      );
    item.deliveryStatus = ReminderDeliveryStatus.SENT;
    item.sentAt = new Date();
    item.deliveryError = null;
    await this.repository.save(item);
    return this.findOne(id);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async dispatchDueEmails(): Promise<void> {
    if (this.dispatching) return;
    if (!this.email.enabled) {
      this.logger.debug('Email delivery disabled, skipping due reminders');
      return;
    }
    this.dispatching = true;
    try {
      await this.audit.run(
        { actorUserId: null, context: AuditContextKind.SYSTEM },
        async () => {
          const due = await this.repository.find({
            where: {
              channel: ReminderChannel.EMAIL,
              deliveryStatus: ReminderDeliveryStatus.PENDING,
              status: ReminderStatus.PENDING,
              isHistorical: false,
              remindAt: LessThanOrEqual(new Date()),
            },
            relations: {
              medicalAppointment: { healthCenter: true },
              subjectPatient: true,
            },
            order: { remindAt: 'ASC' },
            take: DISPATCH_BATCH_SIZE,
          });
          for (const item of due) await this.deliver(item);
        },
      );
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Reminder dispatch failed',
      );
    } finally {
      this.dispatching = false;
    }
  }

  /** El texto del agente reemplaza al sugerido; el asunto se mantiene. */
  private async messageFor(item: Reminder) {
    const suggested = await this.suggestedMessageFor(item);
    return {
      subject: suggested.subject,
      text: item.customMessage?.trim() || suggested.text,
      defaultText: suggested.text,
    };
  }

  private async suggestedMessageFor(item: Reminder) {
    const appointment = item.medicalAppointment;
    if (!appointment?.specialty) return buildReminderMessage(item);
    const resolved = await this.catalogValues.tryResolve(
      'medical_specialty',
      appointment.specialty,
      { allowInactive: true, otherText: appointment.specialtyOther },
    );
    const label =
      resolved?.code === 'OTRO' && resolved.other
        ? resolved.other
        : resolved?.label;
    return buildReminderMessage(item, label);
  }

  private async deliver(item: Reminder) {
    const email = item.subjectPatient?.email?.trim();
    const message = await this.messageFor(item);
    const result = email
      ? await this.email.send({
          to: email,
          subject: message.subject,
          text: message.text,
        })
      : ({
          status: 'FAILED',
          error: 'El paciente no tiene correo registrado.',
        } as const);
    const patch =
      result.status === 'SENT'
        ? {
            deliveryStatus: ReminderDeliveryStatus.SENT,
            sentAt: new Date(),
            deliveryError: null,
          }
        : {
            deliveryStatus: ReminderDeliveryStatus.FAILED,
            deliveryError:
              result.status === 'DISABLED'
                ? 'El envío de correos no está configurado.'
                : result.error,
          };
    await this.repository.update({ id: item.id }, patch);
  }

  private async applyAppointmentCompletion(
    reminder: Reminder,
    payload: CompleteReminderMedicalAppointmentDto,
  ) {
    if (payload.status === MedicalAppointmentStatus.SCHEDULED) {
      throw new BadRequestException(
        'Para completar el recordatorio, cambia el estado de la cita.',
      );
    }

    const existing = await this.appointments.findOne({
      where: { id: reminder.medicalAppointmentId! },
    });
    if (!existing) {
      throw new NotFoundException('No se encontró la cita médica vinculada.');
    }

    const appointment = await this.versioning.replaceCurrent(
      PatientMedicalAppointment,
      {
        patientId: existing.patientId,
        specialty: existing.specialty,
        isCurrent: true,
      },
      {
        patientId: existing.patientId,
        followUpId: existing.followUpId,
        specialty: existing.specialty,
        healthCenterId: existing.healthCenterId,
        appointmentDate: existing.appointmentDate,
        appointmentTime: existing.appointmentTime,
        nextAppointmentDate:
          payload.nextAppointmentDate !== undefined
            ? payload.nextAppointmentDate
            : existing.nextAppointmentDate,
        nextAppointmentSpecialty:
          payload.nextAppointmentSpecialty !== undefined
            ? payload.nextAppointmentSpecialty
            : existing.nextAppointmentSpecialty,
        hasReferralSheet:
          payload.status === MedicalAppointmentStatus.COMPLETED
            ? (payload.hasReferralSheet ?? existing.hasReferralSheet)
            : existing.hasReferralSheet,
        referredTo:
          payload.status === MedicalAppointmentStatus.COMPLETED
            ? (payload.referredTo ?? existing.referredTo)
            : existing.referredTo,
        referralNotProvidedReason:
          payload.status === MedicalAppointmentStatus.COMPLETED
            ? (payload.referralNotProvidedReason ??
              existing.referralNotProvidedReason)
            : existing.referralNotProvidedReason,
        difficulties:
          payload.difficulties !== undefined
            ? payload.difficulties
            : existing.difficulties,
        attendedViaSepa:
          payload.status === MedicalAppointmentStatus.COMPLETED
            ? (payload.attendedViaSepa ?? existing.attendedViaSepa)
            : existing.attendedViaSepa,
        referredViaSepa:
          payload.status === MedicalAppointmentStatus.COMPLETED
            ? (payload.referredViaSepa ?? existing.referredViaSepa)
            : existing.referredViaSepa,
        isFirstConsultation: existing.isFirstConsultation,
        status: payload.status,
        reminderId: reminder.id,
        changeReason: payload.changeReason,
      },
    );

    reminder.medicalAppointmentId = appointment.id;
    await this.invalidations.markDirty(existing.patientId);
  }

  private async cancelLinkedAppointment(
    reminder: Reminder,
    changeReason: string,
  ) {
    const existing = await this.appointments.findOne({
      where: { id: reminder.medicalAppointmentId! },
    });
    if (!existing) return;

    const appointment = await this.versioning.replaceCurrent(
      PatientMedicalAppointment,
      {
        patientId: existing.patientId,
        specialty: existing.specialty,
        isCurrent: true,
      },
      {
        patientId: existing.patientId,
        followUpId: existing.followUpId,
        specialty: existing.specialty,
        healthCenterId: existing.healthCenterId,
        appointmentDate: existing.appointmentDate,
        appointmentTime: existing.appointmentTime,
        nextAppointmentDate: existing.nextAppointmentDate,
        nextAppointmentSpecialty: existing.nextAppointmentSpecialty,
        hasReferralSheet: existing.hasReferralSheet,
        referredTo: existing.referredTo,
        referralNotProvidedReason: existing.referralNotProvidedReason,
        difficulties: existing.difficulties,
        attendedViaSepa: existing.attendedViaSepa,
        referredViaSepa: existing.referredViaSepa,
        isFirstConsultation: existing.isFirstConsultation,
        status: MedicalAppointmentStatus.CANCELLED,
        reminderId: reminder.id,
        changeReason,
      },
    );
    reminder.medicalAppointmentId = appointment.id;
    await this.invalidations.markDirty(existing.patientId);
  }

  private async syncLinkedAppointmentSchedule(
    reminder: Reminder,
    input: UpdateReminderDto,
  ) {
    const existing = await this.appointments.findOne({
      where: { id: reminder.medicalAppointmentId! },
    });
    if (!existing) return;

    const dueAt = input.dueAt ? new Date(input.dueAt) : reminder.dueAt;
    if (!dueAt)
      throw new BadRequestException(
        'El recordatorio de la cita médica necesita una fecha.',
      );
    const appointment = await this.versioning.replaceCurrent(
      PatientMedicalAppointment,
      {
        patientId: existing.patientId,
        specialty: existing.specialty,
        isCurrent: true,
      },
      {
        patientId: existing.patientId,
        followUpId: existing.followUpId,
        specialty: existing.specialty,
        healthCenterId:
          input.healthCenterId !== undefined
            ? input.healthCenterId
            : existing.healthCenterId,
        appointmentDate: dateOnlyInLima(dueAt),
        appointmentTime: timeInLima(dueAt),
        nextAppointmentDate: existing.nextAppointmentDate,
        nextAppointmentSpecialty: existing.nextAppointmentSpecialty,
        hasReferralSheet: existing.hasReferralSheet,
        referredTo: existing.referredTo,
        referralNotProvidedReason: existing.referralNotProvidedReason,
        difficulties: existing.difficulties,
        isFirstConsultation: existing.isFirstConsultation,
        status: existing.status,
        reminderId: reminder.id,
        changeReason: 'Actualización de fecha desde recordatorio',
      },
    );
    reminder.medicalAppointmentId = appointment.id;
    await this.invalidations.markDirty(existing.patientId);
  }

  private async assertCreateReferences(input: CreateReminderDto) {
    if (!(await this.patients.existsBy({ id: input.subjectPatientId })))
      throw new NotFoundException('No se encontró el paciente.');
    if (
      input.createdFromFollowUpId &&
      !(await this.followUps.existsBy({
        id: input.createdFromFollowUpId,
        subjectPatientId: input.subjectPatientId,
      }))
    )
      throw new BadRequestException(
        'El seguimiento de origen debe ser del mismo paciente.',
      );
  }

  private assertHistoricalDateRange(
    dueOn: string | undefined,
    completedOn: string | undefined,
  ) {
    if (!isDateOnlyRangeValid(dueOn, completedOn))
      throw new BadRequestException(
        'La fecha de realización no puede ser anterior a la del recordatorio.',
      );
  }

  private async assertWriteScope(item: Reminder, user: User) {
    const agentId = await this.agentIdFor(user);
    if (agentId && item.assignedAgentId !== agentId)
      throw new ForbiddenException(
        'Solo puedes modificar tus propios recordatorios.',
      );
  }

  private async agentIdFor(user: User) {
    if (user.role !== UserRole.AGENT) return null;
    const agent = await this.agents.findOne({ where: { userId: user.id } });
    if (!agent)
      throw new BadRequestException('Tu usuario no tiene perfil de agente.');
    return agent.id;
  }

  private async resolveAgentId(
    requestedAgentId: string | undefined,
    user: User,
  ) {
    const agentId = await this.agentIdFor(user);
    if (agentId) {
      if (requestedAgentId && requestedAgentId !== agentId)
        throw new ForbiddenException('No puedes reasignar recordatorios.');
      return agentId;
    }
    if (!requestedAgentId)
      throw new BadRequestException('Selecciona el agente responsable.');
    if (!(await this.agents.existsBy({ id: requestedAgentId })))
      throw new NotFoundException('No se encontró el agente.');
    return requestedAgentId;
  }
}
