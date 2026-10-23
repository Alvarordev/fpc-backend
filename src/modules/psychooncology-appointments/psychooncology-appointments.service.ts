import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AppointmentBeneficiaryType,
  AppointmentModality,
  AppointmentStatus,
  PsychooncologyAppointment,
} from '../../database/entities/psychooncology-appointment.entity';
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
import type { CreateHistoricalPsychooncologyAppointmentDto } from '../historical-records/dto/create-historical-psychooncology-appointment.dto';
import type { UpdateHistoricalPsychooncologyAppointmentDto } from '../historical-records/dto/update-historical-psychooncology-appointment.dto';
import {
  dateOnlyInLima,
  dateOnlyInLimaFromInput,
  isDateOnlyRangeValid,
} from '../../shared/date-only/date-only.util';

@Injectable()
export class PsychooncologyAppointmentsService {
  constructor(
    @InjectRepository(PsychooncologyAppointment)
    private readonly appointments: Repository<PsychooncologyAppointment>,
    private readonly dataSource: DataSource,
    private readonly access: PatientAccessService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

  async create(input: CreatePsychooncologyAppointmentDto, user: User) {
    return this.dataSource.transaction((manager) =>
      this.reserveAndCreate(manager, input, user),
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
    if (!volunteerId)
      await this.access.scopeQuery(query, 'appointment.patient_id', user);
    return query.getMany();
  }

  async findOne(id: string, user: User) {
    const appointment = await this.appointments.findOne({
      where: { id },
      relations: { companion: true, volunteer: true },
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
      const appointment = await manager
        .getRepository(PsychooncologyAppointment)
        .createQueryBuilder('appointment')
        .setLock('pessimistic_write')
        .where('appointment.id = :id', { id })
        .getOne();
      if (!appointment)
        throw new NotFoundException('Psycho-oncology appointment not found');
      this.assertTransition(appointment, input, user);
      this.assertZoomLinkModality(input);
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

      if (
        input.availabilityId &&
        input.availabilityId !== appointment.availabilityId
      ) {
        await this.rescheduleAppointment(
          manager,
          appointment,
          input.availabilityId,
          user,
        );
      }

      if (input.status === AppointmentStatus.CANCELLED) {
        const availability = await this.lockAvailability(
          manager,
          appointment.availabilityId,
        );
        availability.status = AvailabilityStatus.AVAILABLE;
        await manager.getRepository(VolunteerAvailability).save(availability);
      }

      const updates = { ...input };
      delete updates.availabilityId;
      delete updates.beneficiaryType;
      delete updates.companionId;
      Object.assign(appointment, updates);
      appointment.beneficiaryType = beneficiary.beneficiaryType;
      appointment.companionId = beneficiary.companionId;
      appointment.companion = beneficiary.companion;

      if (
        input.availabilityId &&
        appointment.status === AppointmentStatus.NO_ANSWER &&
        input.status === undefined
      ) {
        appointment.status = AppointmentStatus.SCHEDULED;
      }

      if (input.modality === AppointmentModality.CALL) {
        appointment.zoomLink = null;
      }

      if (input.status === AppointmentStatus.COMPLETED) {
        appointment.completedAt = new Date();
        appointment.completedOn = dateOnlyInLima(new Date());
      }

      const saved = await manager
        .getRepository(PsychooncologyAppointment)
        .save(appointment);
      return saved;
    });
  }

  private assertTransition(
    appointment: PsychooncologyAppointment,
    input: UpdatePsychooncologyAppointmentDto,
    user: User,
  ) {
    if (
      [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED].includes(
        appointment.status,
      )
    )
      throw new ConflictException('Closed appointments cannot be updated');

    if (user.role === UserRole.VOLUNTEER) {
      const allowedKeys = new Set([
        'status',
        'availabilityId',
        'modality',
        'zoomLink',
        'schedulingNotes',
        'noAnswerNote',
        'satisfactionRating',
        'satisfactionComment',
        'topicAddressed',
        'sessionDetails',
        'additionalObservations',
        'recommendations',
        'referral',
      ]);
      const disallowed = Object.entries(input).filter(
        ([key, value]) => value !== undefined && !allowedKeys.has(key),
      );
      if (disallowed.length)
        throw new ForbiddenException(
          'Volunteers have limited update permissions',
        );

      if (
        input.status &&
        ![
          AppointmentStatus.COMPLETED,
          AppointmentStatus.CANCELLED,
          AppointmentStatus.NO_ANSWER,
          AppointmentStatus.SCHEDULED,
        ].includes(input.status)
      )
        throw new BadRequestException('Invalid appointment status transition');
      return;
    }

    if (input.status && input.status !== AppointmentStatus.SCHEDULED)
      throw new ForbiddenException(
        'Only volunteers can record psycho-oncology session results',
      );
  }

  private async rescheduleAppointment(
    manager: EntityManager,
    appointment: PsychooncologyAppointment,
    nextAvailabilityId: string,
    user: User,
  ) {
    const nextAvailability = await this.lockAvailability(
      manager,
      nextAvailabilityId,
    );
    if (nextAvailability.isHistorical)
      throw new ConflictException(
        'Historical availability cannot be used for future appointments',
      );
    if (nextAvailability.status !== AvailabilityStatus.AVAILABLE)
      throw new ConflictException('Availability slot is already reserved');

    const nextVolunteer = await manager.getRepository(Volunteer).findOne({
      where: { id: nextAvailability.volunteerId },
    });
    if (!nextVolunteer) throw new NotFoundException('Volunteer not found');
    if (!nextVolunteer.isActive)
      throw new ConflictException('Volunteer is inactive');
    await this.assertScheduleScope(nextAvailability.volunteerId, user);

    const currentAvailability = await this.lockAvailability(
      manager,
      appointment.availabilityId,
    );
    currentAvailability.status = AvailabilityStatus.AVAILABLE;
    await manager
      .getRepository(VolunteerAvailability)
      .save(currentAvailability);

    nextAvailability.status = AvailabilityStatus.RESERVED;
    await manager.getRepository(VolunteerAvailability).save(nextAvailability);

    appointment.availabilityId = nextAvailability.id;
    appointment.volunteerId = nextAvailability.volunteerId;
    appointment.scheduledAt = this.slotDate(nextAvailability);
    appointment.scheduledOn = nextAvailability.date;
  }

  private async reserveAndCreate(
    manager: EntityManager,
    input: CreatePsychooncologyAppointmentDto,
    user: User,
  ) {
    this.assertZoomLinkModality(input);

    const patient = await manager
      .getRepository(Patient)
      .createQueryBuilder('patient')
      .setLock('pessimistic_write')
      .where('patient.id = :id', { id: input.patientId })
      .getOne();
    if (!patient) throw new NotFoundException('Patient not found');

    const availability = await this.lockAvailability(
      manager,
      input.availabilityId,
    );
    if (availability.isHistorical)
      throw new ConflictException(
        'Historical availability cannot be used for future appointments',
      );
    if (availability.status !== AvailabilityStatus.AVAILABLE)
      throw new ConflictException('Availability slot is already reserved');

    const volunteer = await manager.getRepository(Volunteer).findOne({
      where: { id: availability.volunteerId },
    });
    if (!volunteer) throw new NotFoundException('Volunteer not found');
    if (!volunteer.isActive)
      throw new ConflictException('Volunteer is inactive');
    await this.assertScheduleScope(availability.volunteerId, user);

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
    const scheduledAt = this.slotDate(availability);
    availability.status = AvailabilityStatus.RESERVED;
    await manager.getRepository(VolunteerAvailability).save(availability);

    const sessionNumber =
      (await manager.getRepository(PsychooncologyAppointment).count({
        where: { patientId: patient.id },
      })) + 1;
    return manager.getRepository(PsychooncologyAppointment).save(
      manager.getRepository(PsychooncologyAppointment).create({
        patientId: patient.id,
        beneficiaryType: beneficiary.beneficiaryType,
        companionId: beneficiary.companionId,
        companion: beneficiary.companion,
        volunteerId: volunteer.id,
        followUpId: followUp?.id ?? null,
        availabilityId: availability.id,
        patientEmail: input.patientEmail ?? null,
        zoomLink: input.zoomLink ?? null,
        sessionNumber,
        isAdditionalSession: input.isAdditionalSession ?? false,
        modality: input.modality,
        status: AppointmentStatus.SCHEDULED,
        scheduledAt,
        scheduledOn: availability.date,
        completedAt: null,
        completedOn: null,
        isHistorical: false,
        topicAddressed: null,
        sessionDetails: null,
        additionalObservations: null,
        recommendations: null,
        referral: null,
        schedulingNotes: input.schedulingNotes ?? null,
        noAnswerNote: null,
        satisfactionRating: null,
        satisfactionComment: null,
      }),
    );
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

  private async assertScheduleScope(volunteerId: string, user: User) {
    if (user.role !== UserRole.VOLUNTEER) return;

    if ((await this.access.volunteerIdFor(user)) !== volunteerId)
      throw new ForbiddenException(
        'Volunteers can only schedule appointments from their own availability',
      );
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
