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
      if (!patient) throw new NotFoundException('Patient not found');
      if (patient.role !== PatientRole.PATIENT)
        throw new ConflictException('Only a patient can have an appointment');

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
          'Follow-up does not belong to the patient',
        );

      if (!isDateOnlyRangeValid(input.scheduledOn, input.completedOn))
        throw new BadRequestException(
          'completedOn cannot be before scheduledOn',
        );
      if (
        input.scheduledAt &&
        input.completedAt &&
        new Date(input.completedAt) < new Date(input.scheduledAt)
      )
        throw new BadRequestException(
          'completedAt cannot be before scheduledAt',
        );
      if (
        input.scheduledAt &&
        dateOnlyInLimaFromInput(input.scheduledAt) !== input.scheduledOn
      )
        throw new BadRequestException(
          'scheduledAt must belong to scheduledOn in America/Lima',
        );
      if (
        input.completedAt &&
        input.completedOn &&
        dateOnlyInLimaFromInput(input.completedAt) !== input.completedOn
      )
        throw new BadRequestException(
          'completedAt must belong to completedOn in America/Lima',
        );
      if (input.modality === AppointmentModality.CALL && input.zoomLink)
        throw new BadRequestException(
          'Zoom link is only allowed for video call appointments',
        );

      if (input.volunteerId && input.useAnonymousVolunteer)
        throw new BadRequestException(
          'Provide volunteerId or useAnonymousVolunteer, not both',
        );
      if (!input.volunteerId && input.useAnonymousVolunteer !== true)
        throw new BadRequestException(
          'Provide volunteerId or set useAnonymousVolunteer to true',
        );
      const volunteer = input.volunteerId
        ? await volunteers.findOne({ where: { id: input.volunteerId } })
        : await volunteers.findOne({ where: { isAnonymous: true } });
      if (!volunteer) throw new NotFoundException('Volunteer not found');
      if (input.volunteerId && volunteer.isAnonymous)
        throw new BadRequestException(
          'Anonymous volunteer must be selected with useAnonymousVolunteer',
        );

      const beneficiary = await this.resolveBeneficiary(
        manager,
        patient.id,
        input.beneficiaryType,
        input.companionId,
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
        throw new NotFoundException('Psycho-oncology appointment not found');
      if (!appointment.isHistorical)
        throw new BadRequestException(
          'Only historical psycho-oncology appointments can be updated via historical-records',
        );

      if (input.volunteerId && input.useAnonymousVolunteer)
        throw new BadRequestException(
          'Provide volunteerId or useAnonymousVolunteer, not both',
        );
      if (input.volunteerId || input.useAnonymousVolunteer === true) {
        const volunteer = input.volunteerId
          ? await volunteers.findOne({ where: { id: input.volunteerId } })
          : await volunteers.findOne({ where: { isAnonymous: true } });
        if (!volunteer) throw new NotFoundException('Volunteer not found');
        if (input.volunteerId && volunteer.isAnonymous)
          throw new BadRequestException(
            'Anonymous volunteer must be selected with useAnonymousVolunteer',
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
              'Follow-up does not belong to the patient',
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
          'completedOn cannot be before scheduledOn',
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
      .andWhere('appointment.is_historical = false')
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
      throw new NotFoundException('Psycho-oncology appointment not found');
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
      this.assertPending(appointment, 'cancelled');
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
      this.assertPending(original, 'rescheduled');
      if (original.isHistorical)
        throw new ConflictException(
          'Historical appointments cannot be rescheduled',
        );

      const modality = input.modality ?? original.modality;
      this.assertZoomLinkModality({ modality, zoomLink: input.zoomLink });
      const next = await this.reserveSlot(manager, input.availabilityId);
      if (next.availability.id === original.availabilityId)
        throw new ConflictException(
          'The appointment already uses this availability slot',
        );

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

  async markReminderSent(id: string, user: User) {
    const appointment = await this.findOne(id, user);
    this.assertPending(appointment, 'reminded');
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
        'Only no-show appointments can be marked as managed',
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
        'Cancelled or rescheduled appointments cannot be updated',
      );

    const changed = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (user.role === UserRole.VOLUNTEER) {
      if (changed.some((key) => !RESULT_KEYS.has(key)))
        throw new ForbiddenException(
          'Volunteers can only record the results of their sessions',
        );
    } else if (user.role === UserRole.AGENT) {
      if (changed.some((key) => RESULT_KEYS.has(key)))
        throw new ForbiddenException(
          'Session results are recorded by the volunteer, foundation or administrators',
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
        throw new BadRequestException('Invalid appointment status transition');
      if (appointment.scheduledAt && appointment.scheduledAt > new Date())
        throw new BadRequestException(
          'A session cannot be resolved before it starts',
        );
    }
  }

  private assertPending(appointment: PsychooncologyAppointment, verb: string) {
    if (!PENDING_APPOINTMENT_STATUSES.includes(appointment.status))
      throw new ConflictException(
        `Only scheduled or overdue appointments can be ${verb}`,
      );
  }

  private assertReminderSendable(appointment: PsychooncologyAppointment) {
    if (
      appointment.modality === AppointmentModality.VIDEO_CALL &&
      !appointment.zoomLink
    )
      throw new ConflictException(
        'Add the Zoom link before sending the reminder of a video call session',
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
          'remindAt is required for a custom reminder',
        );
      remindAt = new Date(customRemindAt);
      if (scheduledAt && remindAt >= scheduledAt)
        throw new BadRequestException(
          'remindAt must be before the session starts',
        );
    } else if (customRemindAt) {
      throw new BadRequestException(
        'remindAt is only allowed for a custom reminder',
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
      : appointment.scheduledOn;
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
    return {
      appointmentId: appointment.id,
      message: lines.join('\n'),
      reminderMode: appointment.reminderMode,
      remindAt: appointment.remindAt,
      reminderSentAt: appointment.reminderSentAt,
    };
  }

  private async reserveSlot(manager: EntityManager, availabilityId: string) {
    const availability = await this.lockAvailability(manager, availabilityId);
    if (availability.isHistorical)
      throw new ConflictException(
        'Historical availability cannot be used for future appointments',
      );
    if (availability.status !== AvailabilityStatus.AVAILABLE)
      throw new ConflictException('Availability slot is already reserved');

    const volunteer = await manager.getRepository(Volunteer).findOne({
      where: { id: availability.volunteerId },
      relations: { user: true },
    });
    if (!volunteer) throw new NotFoundException('Volunteer not found');
    if (!volunteer.isActive || volunteer.user?.isActive === false)
      throw new ConflictException('Volunteer is inactive');
    const scheduledAt = this.slotDate(availability);
    availability.status = AvailabilityStatus.RESERVED;
    await manager.getRepository(VolunteerAvailability).save(availability);
    return { availability, volunteer, scheduledAt };
  }

  private async openCycle(manager: EntityManager, patientId: string) {
    const cycles = manager.getRepository(PsychooncologyCycle);
    const open = await cycles.findOne({
      where: { patientId, closedAt: IsNull() },
    });
    if (open) return open;
    return cycles.save(cycles.create({ patientId, openedAt: new Date() }));
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
    if (!patient) throw new NotFoundException('Patient not found');
    if (patient.role !== PatientRole.PATIENT)
      throw new ConflictException('Only a patient can have an appointment');

    const followUp = input.followUpId
      ? await manager.getRepository(FollowUp).findOne({
          where: { id: input.followUpId, subjectPatientId: patient.id },
        })
      : null;
    if (input.followUpId && !followUp)
      throw new BadRequestException('Follow-up does not belong to the patient');

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
        `The cycle already has its ${PSYCHOONCOLOGY_BASE_CYCLE_SESSIONS} base sessions; schedule it as an additional session`,
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
          throw new NotFoundException('Psycho-oncology appointment not found');
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
    companion: Patient | null;
  }> {
    const resolvedType = beneficiaryType ?? AppointmentBeneficiaryType.PATIENT;

    if (resolvedType === AppointmentBeneficiaryType.PATIENT) {
      if (companionId !== undefined && companionId !== null) {
        throw new BadRequestException(
          'A patient session cannot include a companion',
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
        'A companion is required for a companion session',
      );
    }

    const companion = await manager.getRepository(Patient).findOne({
      where: { id: companionId },
    });
    if (!companion || companion.role !== PatientRole.COMPANION) {
      throw new NotFoundException('Companion not found');
    }

    const link = await manager.getRepository(CompanionPatient).findOne({
      where: { patientId, companionId },
    });
    if (!link) {
      throw new BadRequestException('Companion does not belong to the patient');
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
        'Zoom link is only allowed for video call appointments',
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
      throw new NotFoundException('Availability slot not found');
    return availability;
  }

  private slotDate(availability: VolunteerAvailability) {
    const scheduledAt = new Date(
      `${availability.date}T${availability.startTime}Z`,
    );
    if (Number.isNaN(scheduledAt.valueOf()))
      throw new BadRequestException(
        'Availability slot has an invalid date or time',
      );
    if (scheduledAt <= new Date())
      throw new ConflictException('Availability slot has already passed');
    return scheduledAt;
  }

  private async assertUpdateScope(id: string, user: User) {
    const appointment = await this.appointments.findOne({ where: { id } });
    if (!appointment)
      throw new NotFoundException('Psycho-oncology appointment not found');
    const volunteerId = await this.access.volunteerIdFor(user);
    if (volunteerId && appointment.volunteerId !== volunteerId)
      throw new ForbiddenException(
        'Volunteers can only modify their own appointments',
      );
  }
}
