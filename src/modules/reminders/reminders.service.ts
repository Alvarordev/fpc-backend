import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    @InjectRepository(PatientMedicalAppointment)
    private readonly appointments: Repository<PatientMedicalAppointment>,
    private readonly access: PatientAccessService,
    private readonly versioning: HistoryVersioningService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => FollowUpsService))
    private readonly followUpsService: FollowUpsService,
  ) {}

  async create(input: CreateReminderDto, user: User) {
    const kind = input.kind ?? ReminderKind.GENERIC;
    if (
      kind === ReminderKind.MEDICAL_APPOINTMENT &&
      !input.medicalAppointment?.specialty?.trim()
    ) {
      throw new BadRequestException(
        'medicalAppointment.specialty is required for medical appointment reminders',
      );
    }

    const [assignedAgentId] = await Promise.all([
      this.resolveAgentId(input.assignedAgentId, user),
      this.assertCreateReferences(input),
    ]);

    if (kind !== ReminderKind.MEDICAL_APPOINTMENT) {
      if (!input.description?.trim()) {
        throw new BadRequestException('description is required');
      }
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
      },
    });
    if (!item) throw new NotFoundException('Reminder not found');
    return item;
  }

  async createHistorical(
    input: CreateHistoricalReminderDto,
    historicalLoadedById: string,
  ) {
    this.assertHistoricalDateRange(input.dueOn, input.completedOn);
    const kind = input.kind ?? ReminderKind.GENERIC;
    if (kind === ReminderKind.GENERIC && !input.description.trim())
      throw new BadRequestException('description is required');
    if (
      kind === ReminderKind.MEDICAL_APPOINTMENT &&
      !input.medicalAppointmentId &&
      !input.medicalAppointment?.specialty?.trim()
    )
      throw new BadRequestException(
        'Historical medical appointment reminders require medicalAppointment or medicalAppointmentId',
      );
    if (input.status !== ReminderStatus.DONE && input.completedOn)
      throw new BadRequestException(
        'completedOn is only allowed for DONE reminders',
      );

    const saved = await this.dataSource.transaction(async (manager) => {
      const patients = manager.getRepository(Patient);
      const agents = manager.getRepository(Agent);
      const followUps = manager.getRepository(FollowUp);
      const appointments = manager.getRepository(PatientMedicalAppointment);

      if (!(await patients.existsBy({ id: input.subjectPatientId })))
        throw new NotFoundException('Patient not found');
      if (!(await agents.existsBy({ id: input.assignedAgentId })))
        throw new NotFoundException('Agent not found');
      if (
        input.createdFromFollowUpId &&
        !(await followUps.existsBy({
          id: input.createdFromFollowUpId,
          subjectPatientId: input.subjectPatientId,
        }))
      )
        throw new BadRequestException(
          'Source follow-up must belong to the reminder patient',
        );
      if (
        input.resultingFollowUpId &&
        !(await followUps.existsBy({
          id: input.resultingFollowUpId,
          subjectPatientId: input.subjectPatientId,
        }))
      )
        throw new BadRequestException(
          'Resulting follow-up must belong to the reminder patient',
        );

      let medicalAppointmentId = input.medicalAppointmentId ?? null;
      if (input.medicalAppointmentId) {
        const appointment = await appointments.findOneBy({
          id: input.medicalAppointmentId,
          patientId: input.subjectPatientId,
        });
        if (!appointment)
          throw new BadRequestException(
            'Medical appointment must belong to the reminder patient',
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
          throw new NotFoundException('Health center not found');
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
          resultingFollowUpId: input.resultingFollowUpId ?? null,
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
      if (!item) throw new NotFoundException('Reminder not found');
      if (!item.isHistorical)
        throw new BadRequestException(
          'Only historical reminders can be updated via historical-records',
        );

      if (input.assignedAgentId !== undefined) {
        if (
          !(await manager
            .getRepository(Agent)
            .existsBy({ id: input.assignedAgentId }))
        )
          throw new NotFoundException('Agent not found');
        item.assignedAgentId = input.assignedAgentId;
      }
      if (input.dueOn !== undefined) item.dueOn = input.dueOn;
      if (input.completedOn !== undefined) item.completedOn = input.completedOn;
      if (input.description !== undefined)
        item.description = input.description.trim();
      if (input.status !== undefined) item.status = input.status;
      if (input.createdFromFollowUpId !== undefined)
        item.createdFromFollowUpId = input.createdFromFollowUpId;
      if (input.resultingFollowUpId !== undefined)
        item.resultingFollowUpId = input.resultingFollowUpId;

      if (item.status !== ReminderStatus.DONE && item.completedOn)
        throw new BadRequestException(
          'completedOn is only allowed for DONE reminders',
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
          throw new NotFoundException('Linked medical appointment not found');
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
          'Historical medical reminder is missing its appointment link',
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

    if (item.kind === ReminderKind.MEDICAL_APPOINTMENT) {
      if (!input.medicalAppointment) {
        throw new BadRequestException(
          'medicalAppointment payload is required to complete a medical appointment reminder',
        );
      }
      if (!item.medicalAppointmentId) {
        throw new BadRequestException(
          'Medical appointment reminder is missing its linked appointment',
        );
      }
      await this.applyAppointmentCompletion(item, input.medicalAppointment);
    }

    item.status = ReminderStatus.DONE;
    item.completedAt = new Date();
    item.completedOn = dateOnlyInLima(new Date());
    item.resultingFollowUpId = input.resultingFollowUpId ?? null;
    const saved = await this.repository.save(item);
    return this.findOne(saved.id);
  }

  async dismiss(id: string, user: User) {
    const item = await this.findOne(id);
    await this.assertWriteScope(item, user);
    if (item.status !== ReminderStatus.PENDING)
      throw new BadRequestException('Only pending reminders can be dismissed');

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
      throw new BadRequestException('Closed reminders cannot be edited');
    const assignedAgentId = input.assignedAgentId
      ? await this.resolveAgentId(input.assignedAgentId, user)
      : undefined;

    if (input.dueAt) {
      item.dueAt = new Date(input.dueAt);
      item.dueOn = dateOnlyInLimaFromInput(input.dueAt);
    }
    if (input.description !== undefined) item.description = input.description;
    if (assignedAgentId) item.assignedAgentId = assignedAgentId;

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
      .andWhere('reminder.is_historical = false')
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
    const appointmentDate = dateOnlyInLimaFromInput(input.dueAt);
    const appointmentTime = dueAt.toISOString().slice(11, 16);
    const description = input.description?.trim() || `Cita: ${specialty}`;

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
          appointmentDate,
          appointmentTime,
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

      const reminder = await manager.getRepository(Reminder).save(
        manager.getRepository(Reminder).create({
          subjectPatientId: input.subjectPatientId,
          createdFromFollowUpId: input.createdFromFollowUpId ?? null,
          assignedAgentId,
          dueAt,
          dueOn: dateOnlyInLimaFromInput(input.dueAt),
          description,
          kind: ReminderKind.MEDICAL_APPOINTMENT,
          medicalAppointmentId: appointment.id,
          status: ReminderStatus.PENDING,
          completedOn: null,
          isHistorical: false,
        }),
      );

      await manager
        .getRepository(PatientMedicalAppointment)
        .update({ id: appointment.id }, { reminderId: reminder.id });

      await this.invalidations.markDirty(input.subjectPatientId, manager);
      return manager.getRepository(Reminder).findOneOrFail({
        where: { id: reminder.id },
        relations: {
          medicalAppointment: { healthCenter: true },
        },
      });
    });
  }

  private async applyAppointmentCompletion(
    reminder: Reminder,
    payload: CompleteReminderMedicalAppointmentDto,
  ) {
    if (payload.status === MedicalAppointmentStatus.SCHEDULED) {
      throw new BadRequestException(
        'Cannot complete a medical appointment reminder while keeping status SCHEDULED',
      );
    }

    const existing = await this.appointments.findOne({
      where: { id: reminder.medicalAppointmentId! },
    });
    if (!existing) {
      throw new NotFoundException('Linked medical appointment not found');
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
        'A medical appointment reminder must have a due date',
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
        appointmentDate: dueAt.toISOString().slice(0, 10),
        appointmentTime: dueAt.toISOString().slice(11, 16),
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

  private assertHistoricalDateRange(
    dueOn: string | undefined,
    completedOn: string | undefined,
  ) {
    if (!isDateOnlyRangeValid(dueOn, completedOn))
      throw new BadRequestException('completedOn cannot be before dueOn');
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
