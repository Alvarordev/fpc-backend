import { Companion } from '../../database/entities/companion.entity';
import { formatDateEs } from '../reminders/reminder-message';
import { EmailService } from '../../integrations/email/email.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import {
  AppointmentBeneficiaryType,
  AppointmentModality,
  AppointmentReminderMode,
  AppointmentStatus,
  PENDING_APPOINTMENT_STATUSES,
  PsychooncologyAppointment,
} from '../../database/entities/psychooncology-appointment.entity';
import {
  PSYCHOONCOLOGY_BASE_CYCLE_SESSIONS,
  PsychooncologyCycle,
} from '../../database/entities/psychooncology-cycle.entity';
import { CompanionPatient } from '../../database/entities/companion-patient.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { Patient } from '../../database/entities/patient.entity';
import { PatientRole } from '../../database/entities/patient-role.enum';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import {
  AvailabilityStatus,
  VolunteerAvailability,
} from '../../database/entities/volunteer-availability.entity';
import { Volunteer } from '../../database/entities/volunteer.entity';
import { PatientAccessService } from '../patients/access/patient-access.service';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import { CreatePsychooncologyAppointmentDto } from './dto/create-psychooncology-appointment.dto';
import { FindPsychooncologyAppointmentsQueryDto } from './dto/list-psychooncology-appointments.dto';
import { UpdatePsychooncologyAppointmentDto } from './dto/update-psychooncology-appointment.dto';
import { ReschedulePsychooncologyAppointmentDto } from './dto/reschedule-psychooncology-appointment.dto';
import type { CreateHistoricalPsychooncologyAppointmentDto } from '../historical-records/dto/create-historical-psychooncology-appointment.dto';
import type { UpdateHistoricalPsychooncologyAppointmentDto } from '../historical-records/dto/update-historical-psychooncology-appointment.dto';
import {
  dateOnlyInLima,
  dateOnlyInLimaFromInput,
  isDateOnlyRangeValid,
  isNotAfterTodayInLima,
} from '../../shared/date-only/date-only.util';

const RESULT_KEYS = new Set([
  'status',
  'topicAddressed',
  'sessionDetails',
  'additionalObservations',
  'recommendations',
  'referral',
  'noAnswerNote',
  'satisfactionRating',
  'satisfactionComment',
]);

@Injectable()
export class PsychooncologyAppointmentsService {
  constructor(
    private readonly email: EmailService,
    @InjectRepository(PsychooncologyAppointment)
    private readonly appointments: Repository<PsychooncologyAppointment>,
    private readonly dataSource: DataSource,
    private readonly access: PatientAccessService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

  async create(input: CreatePsychooncologyAppointmentDto) {
    return this.dataSource.transaction((manager) =>
      this.reserveAndCreate(manager, input),
    );
  }

  async createHistorical(
    input: CreateHistoricalPsychooncologyAppointmentDto,
    historicalLoadedById: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const patients = manager.getRepository(Patient);
      const appointments = manager.getRepository(PsychooncologyAppointment);
      const availabilities = manager.getRepository(VolunteerAvailability);
      const volunteers = manager.getRepository(Volunteer);

      const patient = await patients.findOne({
        where: { id: input.patientId },
      });
      if (!patient) throw new NotFoundException('No se encontró el paciente.');
      if (patient.role !== PatientRole.PATIENT)
        throw new ConflictException('Solo un paciente puede tener una cita.');

      const followUp = input.followUpId
        ? await manager.getRepository(FollowUp).findOne({
            where: {
              id: input.followUpId,
              subjectPatientId: input.patientId,
            },
          })
        : null;
      if (input.followUpId && !followUp)
        throw new BadRequestException(
          'El seguimiento no pertenece a este paciente.',
        );

      if (!isDateOnlyRangeValid(input.scheduledOn, input.completedOn))
        throw new BadRequestException(
          'La fecha de realización no puede ser anterior a la programada.',
        );
      this.assertHistoricalNotFuture(
        input.status,
        input.completedOn ?? input.completedAt ?? input.scheduledOn,
      );
      if (
        input.scheduledAt &&
        input.completedAt &&
        new Date(input.completedAt) < new Date(input.scheduledAt)
      )
        throw new BadRequestException(
          'La fecha de realización no puede ser anterior a la programada.',
        );
      if (
        input.scheduledAt &&
        dateOnlyInLimaFromInput(input.scheduledAt) !== input.scheduledOn
      )
        throw new BadRequestException(
          'La hora programada no coincide con su fecha.',
        );
      if (
        input.completedAt &&
        input.completedOn &&
        dateOnlyInLimaFromInput(input.completedAt) !== input.completedOn
      )
        throw new BadRequestException(
          'La hora de realización no coincide con su fecha.',
        );
      if (input.modality === AppointmentModality.CALL && input.zoomLink)
        throw new BadRequestException(
          'El enlace de Zoom solo aplica a videollamadas.',
        );

      if (input.volunteerId && input.useAnonymousVolunteer)
        throw new BadRequestException(
          'Elige un voluntario o el voluntario anónimo, no ambos.',
        );
      if (!input.volunteerId && input.useAnonymousVolunteer !== true)
        throw new BadRequestException('Selecciona un voluntario.');
      const volunteer = input.volunteerId
        ? await volunteers.findOne({ where: { id: input.volunteerId } })
        : await volunteers.findOne({ where: { isAnonymous: true } });
      if (!volunteer)
        throw new NotFoundException('No se encontró el voluntario.');
      if (input.volunteerId && volunteer.isAnonymous)
        throw new BadRequestException(
          'Para usar el voluntario anónimo, márcalo como anónimo.',
        );

      const beneficiary = await this.resolveBeneficiary(
        manager,
        patient.id,
        input.beneficiaryType,
        input.companionId,
      );
      // La sesión histórica cuenta en el ciclo del paciente, abierto desde su fecha real.
      const cycle = await this.openCycle(
        manager,
        patient.id,
        new Date(`${input.scheduledOn}T12:00:00-05:00`),
      );
      const availability = await availabilities.save(
        availabilities.create({
          volunteerId: volunteer.id,
          date: input.scheduledOn,
          startTime: null,
          endTime: null,
          status: AvailabilityStatus.RESERVED,
          isHistorical: true,
          historicalLoadedById,
        }),
      );
      const appointment = await appointments.save(
        appointments.create({
          patientId: patient.id,
          beneficiaryType: beneficiary.beneficiaryType,
          companionId: beneficiary.companionId,
          companion: beneficiary.companion,
          volunteerId: volunteer.id,
          followUpId: followUp?.id ?? null,
          availabilityId: availability.id,
          cycleId: cycle.id,
          historicalLoadedById,
          patientEmail: input.patientEmail ?? null,
          zoomLink: input.zoomLink ?? null,
          sessionNumber: input.sessionNumber,
          isAdditionalSession: input.isAdditionalSession ?? false,
          modality: input.modality,
          status: input.status,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          scheduledOn: input.scheduledOn,
          completedAt: input.completedAt ? new Date(input.completedAt) : null,
          completedOn:
            input.completedOn ??
            (input.completedAt
              ? dateOnlyInLimaFromInput(input.completedAt)
              : null),
          schedulingNotes: input.schedulingNotes ?? null,
          noAnswerNote: input.noAnswerNote ?? null,
          satisfactionRating: input.satisfactionRating ?? null,
          satisfactionComment: input.satisfactionComment ?? null,
          topicAddressed: input.topicAddressed ?? null,
          sessionDetails: input.sessionDetails ?? null,
          additionalObservations: input.additionalObservations ?? null,
          recommendations: input.recommendations ?? null,
          referral: input.referral ?? null,
          isHistorical: true,
        }),
      );
      await this.invalidations.markDirty(patient.id, manager);
      return appointments.findOneOrFail({
        where: { id: appointment.id },
        relations: {
          patient: true,
          companion: true,
          volunteer: true,
          availability: true,
        },
      });
    });
  }

  async updateHistorical(
    id: string,
    input: UpdateHistoricalPsychooncologyAppointmentDto,
    historicalLoadedById: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const appointments = manager.getRepository(PsychooncologyAppointment);
      const availabilities = manager.getRepository(VolunteerAvailability);
      const volunteers = manager.getRepository(Volunteer);

      const appointment = await appointments.findOne({
        where: { id },
        relations: { volunteer: true, availability: true },
      });
      if (!appointment)
        throw new NotFoundException(
          'No se encontró la cita de psicooncología.',
        );
      if (!appointment.isHistorical)
        throw new BadRequestException(
          'Desde carga histórica solo se editan citas de psicooncología históricas.',
        );

      if (input.volunteerId && input.useAnonymousVolunteer)
        throw new BadRequestException(
          'Elige un voluntario o el voluntario anónimo, no ambos.',
        );
      if (input.volunteerId || input.useAnonymousVolunteer === true) {
        const volunteer = input.volunteerId
          ? await volunteers.findOne({ where: { id: input.volunteerId } })
          : await volunteers.findOne({ where: { isAnonymous: true } });
        if (!volunteer)
          throw new NotFoundException('No se encontró el voluntario.');
        if (input.volunteerId && volunteer.isAnonymous)
          throw new BadRequestException(
            'Para usar el voluntario anónimo, márcalo como anónimo.',
          );
        appointment.volunteerId = volunteer.id;
        const availability = await availabilities.findOne({
          where: { id: appointment.availabilityId },
        });
        if (availability) {
          availability.volunteerId = volunteer.id;
          availability.historicalLoadedById = historicalLoadedById;
          if (input.scheduledOn) availability.date = input.scheduledOn;
          await availabilities.save(availability);
        }
      } else if (input.scheduledOn) {
        const availability = await availabilities.findOne({
          where: { id: appointment.availabilityId },
        });
        if (availability) {
          availability.date = input.scheduledOn;
          await availabilities.save(availability);
        }
      }

      if (input.followUpId !== undefined) {
        if (input.followUpId) {
          const followUp = await manager.getRepository(FollowUp).findOne({
            where: {
              id: input.followUpId,
              subjectPatientId: appointment.patientId,
            },
          });
          if (!followUp)
            throw new BadRequestException(
              'El seguimiento no pertenece a este paciente.',
            );
          appointment.followUpId = followUp.id;
        } else {
          appointment.followUpId = null;
        }
      }

      if (
        input.beneficiaryType !== undefined ||
        input.companionId !== undefined
      ) {
        const beneficiary = await this.resolveBeneficiary(
          manager,
          appointment.patientId,
          input.beneficiaryType ?? appointment.beneficiaryType,
          input.companionId !== undefined
            ? input.companionId
            : appointment.companionId,
        );
        appointment.beneficiaryType = beneficiary.beneficiaryType;
        appointment.companionId = beneficiary.companionId;
        appointment.companion = beneficiary.companion;
      }

      if (input.sessionNumber !== undefined)
        appointment.sessionNumber = input.sessionNumber;
      if (input.isAdditionalSession !== undefined)
        appointment.isAdditionalSession = input.isAdditionalSession;
      if (input.modality !== undefined) appointment.modality = input.modality;
      if (input.status !== undefined) appointment.status = input.status;
      if (input.scheduledOn !== undefined)
        appointment.scheduledOn = input.scheduledOn;
      if (input.completedOn !== undefined)
        appointment.completedOn = input.completedOn ?? null;
      if (input.scheduledAt !== undefined)
        appointment.scheduledAt = input.scheduledAt
          ? new Date(input.scheduledAt)
          : null;
      if (input.completedAt !== undefined)
        appointment.completedAt = input.completedAt
          ? new Date(input.completedAt)
          : null;
      if (input.patientEmail !== undefined)
        appointment.patientEmail = input.patientEmail;
      if (input.zoomLink !== undefined) appointment.zoomLink = input.zoomLink;
      if (input.schedulingNotes !== undefined)
        appointment.schedulingNotes = input.schedulingNotes;
      if (input.noAnswerNote !== undefined)
        appointment.noAnswerNote = input.noAnswerNote;
      if (input.satisfactionRating !== undefined)
        appointment.satisfactionRating = input.satisfactionRating;
      if (input.satisfactionComment !== undefined)
        appointment.satisfactionComment = input.satisfactionComment;
      if (input.topicAddressed !== undefined)
        appointment.topicAddressed = input.topicAddressed;
      if (input.sessionDetails !== undefined)
        appointment.sessionDetails = input.sessionDetails;
      if (input.additionalObservations !== undefined)
        appointment.additionalObservations = input.additionalObservations;
      if (input.recommendations !== undefined)
        appointment.recommendations = input.recommendations;
      if (input.referral !== undefined) appointment.referral = input.referral;

      if (appointment.modality === AppointmentModality.CALL)
        appointment.zoomLink = null;
      if (
        !isDateOnlyRangeValid(appointment.scheduledOn, appointment.completedOn)
      )
        throw new BadRequestException(
          'La fecha de realización no puede ser anterior a la programada.',
        );
      this.assertHistoricalNotFuture(
        appointment.status,
        appointment.completedOn ??
          appointment.completedAt ??
          appointment.scheduledOn,
      );

      await appointments.save(appointment);
      await this.invalidations.markDirty(appointment.patientId, manager);
      return appointments.findOneOrFail({
        where: { id: appointment.id },
        relations: {
          patient: true,
          companion: true,
          volunteer: true,
          availability: true,
        },
      });
    });
  }

  async findAll(
    queryInput: FindPsychooncologyAppointmentsQueryDto,
    user: User,
  ) {
    const query = this.appointments
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.companion', 'companion')
      .leftJoinAndSelect('appointment.volunteer', 'volunteer')
      .orderBy('appointment.scheduled_on', 'DESC', 'NULLS LAST')
      .addOrderBy('appointment.scheduled_at', 'DESC', 'NULLS LAST')
      .addOrderBy('appointment.id', 'DESC');
    const volunteerId = await this.access.volunteerIdFor(user);
    if (volunteerId) {
      query.andWhere('appointment.volunteer_id = :volunteerId', {
        volunteerId,
      });
    } else if (queryInput.volunteerId) {
      query.andWhere('appointment.volunteer_id = :volunteerId', {
        volunteerId: queryInput.volunteerId,
      });
    }
    if (queryInput.patientId)
      query.andWhere('appointment.patient_id = :patientId', {
        patientId: queryInput.patientId,
      });
    if (queryInput.status)
      query.andWhere('appointment.status = :status', {
        status: queryInput.status,
      });
    if (queryInput.cycleId)
      query.andWhere('appointment.cycle_id = :cycleId', {
        cycleId: queryInput.cycleId,
      });
    if (queryInput.needsReassignment !== undefined)
      query.andWhere('appointment.needs_reassignment = :needsReassignment', {
        needsReassignment: queryInput.needsReassignment,
      });
    if (!volunteerId)
      await this.access.scopeQuery(query, 'appointment.patient_id', user);
    return query.getMany();
  }

  async findOne(id: string, user: User) {
    const appointment = await this.appointments.findOne({
      where: { id },
      relations: { patient: true, companion: true, volunteer: true },
    });
    if (!appointment)
      throw new NotFoundException('No se encontró la cita de psicooncología.');
    await this.access.assertCanRead(appointment.patientId, user);
    return appointment;
  }

  async update(
    id: string,
    input: UpdatePsychooncologyAppointmentDto,
    user: User,
  ) {
    await this.assertUpdateScope(id, user);
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.lockAppointment(manager, id);
      this.assertEditable(appointment, input, user);
      this.assertZoomLinkModality(input);

      if (
        input.beneficiaryType !== undefined ||
        input.companionId !== undefined
      ) {
        const beneficiary = await this.resolveBeneficiary(
          manager,
          appointment.patientId,
          input.beneficiaryType ?? appointment.beneficiaryType,
          input.beneficiaryType === AppointmentBeneficiaryType.PATIENT
            ? null
            : input.companionId !== undefined
              ? input.companionId
              : appointment.companionId,
        );
        appointment.beneficiaryType = beneficiary.beneficiaryType;
        appointment.companionId = beneficiary.companionId;
        appointment.companion = beneficiary.companion;
      }

      const updates = { ...input };
      delete updates.beneficiaryType;
      delete updates.companionId;
      delete updates.reminderMode;
      delete updates.remindAt;
      Object.assign(appointment, updates);

      if (appointment.modality === AppointmentModality.CALL)
        appointment.zoomLink = null;

      if (input.reminderMode !== undefined || input.remindAt !== undefined)
        this.applyReminder(
          appointment,
          input.reminderMode ?? appointment.reminderMode,
          input.remindAt,
        );

      if (input.status === AppointmentStatus.COMPLETED) {
        appointment.completedAt = new Date();
        appointment.completedOn = dateOnlyInLima(new Date());
        appointment.noShowManagedAt = null;
        appointment.noShowManagedById = null;
      } else if (input.status === AppointmentStatus.NO_SHOW) {
        appointment.completedAt = null;
        appointment.completedOn = null;
      }

      await manager.getRepository(PsychooncologyAppointment).save(appointment);
      return this.loadAppointment(manager, appointment.id);
    });
  }

  async cancel(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const appointment = await this.lockAppointment(manager, id);
      this.assertPending(appointment, 'cancelar');
      const availability = await this.lockAvailability(
        manager,
        appointment.availabilityId,
      );
      availability.status = AvailabilityStatus.AVAILABLE;
      await manager.getRepository(VolunteerAvailability).save(availability);
      appointment.status = AppointmentStatus.CANCELLED;
      appointment.needsReassignment = false;
      await manager.getRepository(PsychooncologyAppointment).save(appointment);
      return this.loadAppointment(manager, appointment.id);
    });
  }

  /**
   * Moves a pending session to another free slot, possibly of another
   * volunteer. The original stays RESCHEDULED and points to the new session.
   */
  async reschedule(id: string, input: ReschedulePsychooncologyAppointmentDto) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PsychooncologyAppointment);
      const original = await this.lockAppointment(manager, id);
      this.assertPending(original, 'reprogramar');
      if (original.isHistorical)
        throw new ConflictException(
          'Una cita histórica no se puede reprogramar.',
        );

      const modality = input.modality ?? original.modality;
      this.assertZoomLinkModality({ modality, zoomLink: input.zoomLink });
      const next = await this.reserveSlot(manager, input.availabilityId);
      if (next.availability.id === original.availabilityId)
        throw new ConflictException('La cita ya usa ese horario.');

      const current = await this.lockAvailability(
        manager,
        original.availabilityId,
      );
      current.status = AvailabilityStatus.AVAILABLE;
      await manager.getRepository(VolunteerAvailability).save(current);

      const sameVolunteer = next.volunteer.id === original.volunteerId;
      const replacement = repository.create({
        patientId: original.patientId,
        beneficiaryType: original.beneficiaryType,
        companionId: original.companionId,
        volunteerId: next.volunteer.id,
        followUpId: original.followUpId,
        cycleId: original.cycleId,
        availabilityId: next.availability.id,
        patientEmail: original.patientEmail,
        zoomLink:
          modality === AppointmentModality.CALL
            ? null
            : (input.zoomLink ?? (sameVolunteer ? original.zoomLink : null)),
        sessionNumber: original.sessionNumber,
        isAdditionalSession: original.isAdditionalSession,
        modality,
        status: AppointmentStatus.SCHEDULED,
        scheduledAt: next.scheduledAt,
        scheduledOn: next.availability.date,
        completedAt: null,
        completedOn: null,
        isHistorical: false,
        needsReassignment: false,
        reminderSentAt: null,
        topicAddressed: null,
        sessionDetails: null,
        additionalObservations: null,
        recommendations: null,
        referral: null,
        schedulingNotes: input.schedulingNotes ?? original.schedulingNotes,
        noAnswerNote: null,
        satisfactionRating: null,
        satisfactionComment: null,
      });
      const mode = input.reminderMode ?? original.reminderMode;
      this.applyReminder(
        replacement,
        mode === AppointmentReminderMode.CUSTOM && !input.remindAt
          ? AppointmentReminderMode.MANUAL
          : mode,
        input.remindAt,
      );
      const saved = await repository.save(replacement);

      original.status = AppointmentStatus.RESCHEDULED;
      original.rescheduledToId = saved.id;
      original.needsReassignment = false;
      await repository.save(original);
      return this.loadAppointment(manager, saved.id);
    });
  }

  /** Pending sessions whose volunteer left; agents must reschedule them. */
  findNeedingReassignment(user: User) {
    const query = this.appointments
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.companion', 'companion')
      .leftJoinAndSelect('appointment.volunteer', 'volunteer')
      .where('appointment.needs_reassignment = true')
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: PENDING_APPOINTMENT_STATUSES,
      })
      .orderBy('appointment.scheduled_at', 'ASC', 'NULLS LAST');
    return this.access
      .scopeQuery(query, 'appointment.patient_id', user)
      .then((scoped) => scoped.getMany());
  }

  async reminderMessage(id: string, user: User) {
    const appointment = await this.findOne(id, user);
    this.assertReminderSendable(appointment);
    return this.toReminder(appointment);
  }

  /** Guarda el texto del recordatorio; vacío vuelve al texto sugerido. */
  async setReminderMessage(
    id: string,
    text: string | null | undefined,
    user: User,
  ) {
    const appointment = await this.findOne(id, user);
    this.assertPending(appointment, 'editar el recordatorio de');
    appointment.reminderCustomMessage = text?.trim() || null;
    await this.appointments.update(appointment.id, {
      reminderCustomMessage: appointment.reminderCustomMessage,
    });
    return this.toReminder(appointment);
  }

  async markReminderSent(id: string, user: User) {
    const appointment = await this.findOne(id, user);
    this.assertPending(appointment, 'recordar');
    this.assertReminderSendable(appointment);
    appointment.reminderSentAt = new Date();
    await this.appointments.update(appointment.id, {
      reminderSentAt: appointment.reminderSentAt,
    });
    return this.toReminder(appointment);
  }

  async markNoShowManaged(id: string, user: User) {
    const appointment = await this.findOne(id, user);
    if (appointment.status !== AppointmentStatus.NO_SHOW)
      throw new ConflictException(
        'Solo una inasistencia se puede marcar como gestionada.',
      );
    if (!appointment.noShowManagedAt) {
      await this.appointments.update(appointment.id, {
        noShowManagedAt: new Date(),
        noShowManagedById: user.id,
      });
    }
    return this.findOne(id, user);
  }

  async findUnmanagedNoShows(patientId: string, user: User) {
    await this.access.assertCanRead(patientId, user);
    const items = await this.appointments.find({
      select: { id: true },
      where: {
        patientId,
        status: AppointmentStatus.NO_SHOW,
        isHistorical: false,
        noShowManagedAt: IsNull(),
      },
      order: { scheduledAt: 'ASC' },
    });
    return {
      patientId,
      hasUnmanagedNoShows: items.length > 0,
      count: items.length,
      appointmentIds: items.map((item) => item.id),
    };
  }

  /** Daily: scheduled sessions from previous days that nobody resolved. */
  async markOverdue(today = dateOnlyInLima(new Date())) {
    const result = await this.dataSource.transaction((manager) =>
      manager
        .createQueryBuilder()
        .update(PsychooncologyAppointment)
        .set({ status: AppointmentStatus.OVERDUE })
        .where('status = :status', { status: AppointmentStatus.SCHEDULED })
        .andWhere('is_historical = false')
        .andWhere('scheduled_on < :today', { today })
        .execute(),
    );
    return result.affected ?? 0;
  }

  /**
   * Emails every automatic reminder that is due. Without an email for the
   * patient it stays pending, for the agent to send it by hand.
   */
  async sendDueReminders(now = new Date()) {
    let sent = 0;
    for (const appointment of await this.findDueReminders(now)) {
      const to = appointment.patientEmail ?? appointment.patient?.email;
      if (!to) continue;
      const result = await this.email.send({
        to,
        subject: 'Recordatorio de su sesión de psicooncología',
        text: this.toReminder(appointment).message,
      });
      if (result.status !== 'SENT') continue;
      await this.appointments.update(appointment.id, {
        reminderSentAt: new Date(),
      });
      sent++;
    }
    return sent;
  }

  /** Sessions whose automatic reminder is due and not yet sent. */
  findDueReminders(now = new Date()) {
    return this.appointments
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.companion', 'companion')
      .leftJoinAndSelect('appointment.volunteer', 'volunteer')
      .where('appointment.status = :status', {
        status: AppointmentStatus.SCHEDULED,
      })
      .andWhere('appointment.reminder_mode <> :manual', {
        manual: AppointmentReminderMode.MANUAL,
      })
      .andWhere('appointment.remind_at <= :now', { now })
      .andWhere('appointment.reminder_sent_at IS NULL')
      .andWhere(
        `(appointment.modality <> :video OR appointment.zoom_link IS NOT NULL)`,
        { video: AppointmentModality.VIDEO_CALL },
      )
      .getMany();
  }

  private assertEditable(
    appointment: PsychooncologyAppointment,
    input: UpdatePsychooncologyAppointmentDto,
    user: User,
  ) {
    if (
      [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED].includes(
        appointment.status,
      )
    )
      throw new ConflictException(
        'No se puede modificar una cita cancelada o reprogramada.',
      );

    const changed = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (user.role === UserRole.VOLUNTEER) {
      if (changed.some((key) => !RESULT_KEYS.has(key)))
        throw new ForbiddenException(
          'Solo puedes registrar el resultado de tus sesiones.',
        );
    } else if (user.role === UserRole.AGENT) {
      if (changed.some((key) => RESULT_KEYS.has(key)))
        throw new ForbiddenException(
          'El resultado de la sesión lo registra el voluntario, la fundación o un administrador.',
        );
    }

    if (input.status) {
      if (
        ![
          ...PENDING_APPOINTMENT_STATUSES,
          AppointmentStatus.COMPLETED,
          AppointmentStatus.NO_SHOW,
        ].includes(appointment.status)
      )
        throw new BadRequestException('La cita no puede pasar a ese estado.');
      if (appointment.scheduledAt && appointment.scheduledAt > new Date())
        throw new BadRequestException(
          'No puedes registrar el resultado de una sesión antes de que empiece.',
        );
    }
  }

  /** Una sesión histórica realizada o con inasistencia ya ocurrió: no puede ser futura. */
  private assertHistoricalNotFuture(
    status: AppointmentStatus,
    date: string | Date | null | undefined,
  ) {
    if (
      (status === AppointmentStatus.COMPLETED ||
        status === AppointmentStatus.NO_SHOW) &&
      !isNotAfterTodayInLima(date)
    )
      throw new BadRequestException(
        'Una sesión histórica realizada o sin asistencia no puede tener fecha futura.',
      );
  }

  private assertPending(appointment: PsychooncologyAppointment, verb: string) {
    if (!PENDING_APPOINTMENT_STATUSES.includes(appointment.status))
      throw new ConflictException(
        `Solo se puede ${verb} una cita programada o vencida.`,
      );
  }

  private assertReminderSendable(appointment: PsychooncologyAppointment) {
    if (
      appointment.modality === AppointmentModality.VIDEO_CALL &&
      !appointment.zoomLink
    )
      throw new ConflictException(
        'Agrega el enlace de Zoom antes de enviar el recordatorio de una videollamada.',
      );
  }

  private applyReminder(
    appointment: PsychooncologyAppointment,
    mode: AppointmentReminderMode,
    customRemindAt?: string,
  ) {
    const scheduledAt = appointment.scheduledAt;
    let remindAt: Date | null = null;
    if (mode === AppointmentReminderMode.CUSTOM) {
      if (!customRemindAt)
        throw new BadRequestException(
          'Indica la fecha del recordatorio personalizado.',
        );
      remindAt = new Date(customRemindAt);
      if (scheduledAt && remindAt >= scheduledAt)
        throw new BadRequestException(
          'El recordatorio debe ser antes de la sesión.',
        );
    } else if (customRemindAt) {
      throw new BadRequestException(
        'La fecha del recordatorio solo aplica al recordatorio personalizado.',
      );
    } else if (scheduledAt && mode === AppointmentReminderMode.TWO_HOURS) {
      remindAt = new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1000);
    } else if (scheduledAt && mode === AppointmentReminderMode.ONE_DAY) {
      remindAt = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
    }
    appointment.reminderMode = mode;
    appointment.remindAt = remindAt;
  }

  private toReminder(appointment: PsychooncologyAppointment) {
    const name =
      appointment.beneficiaryType === AppointmentBeneficiaryType.COMPANION
        ? appointment.companion?.fullName
        : appointment.patient?.fullName;
    const when = appointment.scheduledAt
      ? new Intl.DateTimeFormat('es-PE', {
          timeZone: 'America/Lima',
          dateStyle: 'full',
          timeStyle: 'short',
        }).format(appointment.scheduledAt)
      : appointment.scheduledOn
        ? formatDateEs(appointment.scheduledOn)
        : 'día por confirmar';
    const volunteer = appointment.volunteer
      ? `${appointment.volunteer.firstName} ${appointment.volunteer.lastName}`
      : null;
    const lines = [
      `Hola${name ? ` ${name}` : ''}, le recordamos su sesión de psicooncología${
        volunteer ? ` con ${volunteer}` : ''
      } el ${when} (hora de Lima), por ${
        appointment.modality === AppointmentModality.VIDEO_CALL
          ? 'videollamada'
          : 'llamada telefónica'
      }.`,
    ];
    if (appointment.modality === AppointmentModality.VIDEO_CALL)
      lines.push(`Enlace de Zoom: ${appointment.zoomLink}`);
    lines.push(
      'Si no puede asistir, por favor avísenos. Fundación Peruana de Cáncer.',
    );
    const suggested = lines.join('\n');
    return {
      appointmentId: appointment.id,
      // El texto del agente reemplaza al sugerido en la copia y en el envío.
      message: appointment.reminderCustomMessage?.trim() || suggested,
      defaultMessage: suggested,
      isCustom: Boolean(appointment.reminderCustomMessage),
      reminderMode: appointment.reminderMode,
      remindAt: appointment.remindAt,
      reminderSentAt: appointment.reminderSentAt,
    };
  }

  private async reserveSlot(manager: EntityManager, availabilityId: string) {
    const availability = await this.lockAvailability(manager, availabilityId);
    if (availability.isHistorical)
      throw new ConflictException(
        'Un horario histórico no sirve para citas futuras.',
      );
    if (availability.status !== AvailabilityStatus.AVAILABLE)
      throw new ConflictException('Ese horario ya está reservado.');

    const volunteer = await manager.getRepository(Volunteer).findOne({
      where: { id: availability.volunteerId },
      relations: { user: true },
    });
    if (!volunteer)
      throw new NotFoundException('No se encontró el voluntario.');
    if (!volunteer.isActive || volunteer.user?.isActive === false)
      throw new ConflictException('El voluntario está inactivo.');
    const scheduledAt = this.slotDate(availability);
    availability.status = AvailabilityStatus.RESERVED;
    await manager.getRepository(VolunteerAvailability).save(availability);
    return { availability, volunteer, scheduledAt };
  }

  /**
   * Ciclo abierto del paciente, o uno nuevo. `openedAt` es la fecha real de la
   * sesión (carga histórica): si es anterior a la apertura, el ciclo se adelanta.
   */
  private async openCycle(
    manager: EntityManager,
    patientId: string,
    openedAt = new Date(),
  ) {
    const cycles = manager.getRepository(PsychooncologyCycle);
    const open = await cycles.findOne({
      where: { patientId, closedAt: IsNull() },
    });
    if (!open) return cycles.save(cycles.create({ patientId, openedAt }));
    if (openedAt < open.openedAt) {
      open.openedAt = openedAt;
      await cycles.save(open);
    }
    return open;
  }

  private async reserveAndCreate(
    manager: EntityManager,
    input: CreatePsychooncologyAppointmentDto,
  ) {
    this.assertZoomLinkModality(input);
    if (input.modality === AppointmentModality.CALL && input.zoomLink)
      input.zoomLink = undefined;

    const patient = await manager
      .getRepository(Patient)
      .createQueryBuilder('patient')
      .setLock('pessimistic_write')
      .where('patient.id = :id', { id: input.patientId })
      .getOne();
    if (!patient) throw new NotFoundException('No se encontró el paciente.');
    if (patient.role !== PatientRole.PATIENT)
      throw new ConflictException('Solo un paciente puede tener una cita.');

    const followUp = input.followUpId
      ? await manager.getRepository(FollowUp).findOne({
          where: { id: input.followUpId, subjectPatientId: patient.id },
        })
      : null;
    if (input.followUpId && !followUp)
      throw new BadRequestException(
        'El seguimiento no pertenece a este paciente.',
      );

    const beneficiary = await this.resolveBeneficiary(
      manager,
      patient.id,
      input.beneficiaryType,
      input.companionId,
    );

    const cycle = await this.openCycle(manager, patient.id);
    const sessions = await manager
      .getRepository(PsychooncologyAppointment)
      .find({
        select: { id: true, isAdditionalSession: true },
        where: {
          cycleId: cycle.id,
          status: Not(
            In([AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED]),
          ),
        },
      });
    const isAdditionalSession = input.isAdditionalSession ?? false;
    const baseSessions = sessions.filter(
      (session) => !session.isAdditionalSession,
    ).length;
    if (
      !isAdditionalSession &&
      baseSessions >= PSYCHOONCOLOGY_BASE_CYCLE_SESSIONS
    )
      throw new ConflictException(
        `El ciclo ya tiene sus ${PSYCHOONCOLOGY_BASE_CYCLE_SESSIONS} sesiones base; agéndala como sesión adicional.`,
      );

    const { availability, volunteer, scheduledAt } = await this.reserveSlot(
      manager,
      input.availabilityId,
    );

    const repository = manager.getRepository(PsychooncologyAppointment);
    const appointment = repository.create({
      patientId: patient.id,
      beneficiaryType: beneficiary.beneficiaryType,
      companionId: beneficiary.companionId,
      volunteerId: volunteer.id,
      followUpId: followUp?.id ?? null,
      cycleId: cycle.id,
      availabilityId: availability.id,
      patientEmail: input.patientEmail ?? null,
      zoomLink: input.zoomLink ?? null,
      sessionNumber: sessions.length + 1,
      isAdditionalSession,
      modality: input.modality,
      status: AppointmentStatus.SCHEDULED,
      scheduledAt,
      scheduledOn: availability.date,
      completedAt: null,
      completedOn: null,
      isHistorical: false,
      needsReassignment: false,
      reminderSentAt: null,
      topicAddressed: null,
      sessionDetails: null,
      additionalObservations: null,
      recommendations: null,
      referral: null,
      schedulingNotes: input.schedulingNotes ?? null,
      noAnswerNote: null,
      satisfactionRating: null,
      satisfactionComment: null,
    });
    this.applyReminder(
      appointment,
      input.reminderMode ?? AppointmentReminderMode.MANUAL,
      input.remindAt,
    );
    const saved = await repository.save(appointment);
    return this.loadAppointment(manager, saved.id);
  }

  private lockAppointment(manager: EntityManager, id: string) {
    return manager
      .getRepository(PsychooncologyAppointment)
      .createQueryBuilder('appointment')
      .setLock('pessimistic_write')
      .where('appointment.id = :id', { id })
      .getOne()
      .then((appointment) => {
        if (!appointment)
          throw new NotFoundException(
            'No se encontró la cita de psicooncología.',
          );
        return appointment;
      });
  }

  private loadAppointment(manager: EntityManager, id: string) {
    return manager.getRepository(PsychooncologyAppointment).findOneOrFail({
      where: { id },
      relations: { companion: true, volunteer: true },
    });
  }

  private async resolveBeneficiary(
    manager: EntityManager,
    patientId: string,
    beneficiaryType: AppointmentBeneficiaryType | undefined,
    companionId: string | null | undefined,
  ): Promise<{
    beneficiaryType: AppointmentBeneficiaryType;
    companionId: string | null;
    companion: Companion | null;
  }> {
    const resolvedType = beneficiaryType ?? AppointmentBeneficiaryType.PATIENT;

    if (resolvedType === AppointmentBeneficiaryType.PATIENT) {
      if (companionId !== undefined && companionId !== null) {
        throw new BadRequestException(
          'Una sesión del paciente no puede incluir un acompañante.',
        );
      }
      return {
        beneficiaryType: resolvedType,
        companionId: null,
        companion: null,
      };
    }

    if (!companionId) {
      throw new BadRequestException(
        'Selecciona el acompañante para una sesión de acompañante.',
      );
    }

    const companion = await manager.getRepository(Companion).findOne({
      where: { id: companionId },
    });
    if (!companion) {
      throw new NotFoundException('No se encontró el acompañante.');
    }

    const link = await manager.getRepository(CompanionPatient).findOne({
      where: { patientId, companionId },
    });
    if (!link) {
      throw new BadRequestException(
        'El acompañante no está vinculado a este paciente.',
      );
    }

    return {
      beneficiaryType: resolvedType,
      companionId,
      companion,
    };
  }

  private assertZoomLinkModality(input: {
    modality?: AppointmentModality;
    zoomLink?: string | null;
  }) {
    if (input.modality === AppointmentModality.CALL && input.zoomLink)
      throw new BadRequestException(
        'El enlace de Zoom solo aplica a videollamadas.',
      );
  }

  private async lockAvailability(manager: EntityManager, id: string) {
    const availability = await manager
      .getRepository(VolunteerAvailability)
      .createQueryBuilder('availability')
      .setLock('pessimistic_write')
      .where('availability.id = :id', { id })
      .getOne();
    if (!availability)
      throw new NotFoundException('No se encontró el horario.');
    return availability;
  }

  private slotDate(availability: VolunteerAvailability) {
    // Los horarios del voluntario son hora de Lima (UTC-5, sin horario de verano).
    const scheduledAt = new Date(
      `${availability.date}T${availability.startTime}-05:00`,
    );
    if (Number.isNaN(scheduledAt.valueOf()))
      throw new BadRequestException(
        'El horario tiene una fecha u hora inválida.',
      );
    if (scheduledAt <= new Date())
      throw new ConflictException('Ese horario ya pasó.');
    return scheduledAt;
  }

  private async assertUpdateScope(id: string, user: User) {
    const appointment = await this.appointments.findOne({ where: { id } });
    if (!appointment)
      throw new NotFoundException('No se encontró la cita de psicooncología.');
    const volunteerId = await this.access.volunteerIdFor(user);
    if (volunteerId && appointment.volunteerId !== volunteerId)
      throw new ForbiddenException('Solo puedes modificar tus propias citas.');
  }
}
