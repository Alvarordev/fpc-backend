import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  AppointmentBeneficiaryType,
  AppointmentModality,
  AppointmentStatus,
  PsychooncologyAppointment,
} from '../../database/entities/psychooncology-appointment.entity';
import { AvailabilityStatus } from '../../database/entities/volunteer-availability.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { Volunteer } from '../../database/entities/volunteer.entity';
import { PsychooncologyAppointmentsService } from './psychooncology-appointments.service';

describe('PsychooncologyAppointmentsService', () => {
  const service = Object.create(
    PsychooncologyAppointmentsService.prototype,
  ) as PsychooncologyAppointmentsService;

  it('rejects an availability slot whose start has passed', () => {
    expect(() =>
      (
        service as unknown as { slotDate: (availability: unknown) => Date }
      ).slotDate({
        date: '2020-01-01',
        startTime: '09:00:00',
      }),
    ).toThrow(ConflictException);
  });

  it('rejects an availability slot with an invalid date or time', () => {
    expect(() =>
      (
        service as unknown as { slotDate: (availability: unknown) => Date }
      ).slotDate({
        date: 'not-a-date',
        startTime: 'not-a-time',
      }),
    ).toThrow('Availability slot has an invalid date or time');
  });

  it('rejects a Zoom link for a phone call', () => {
    expect(() =>
      (
        service as unknown as {
          assertZoomLinkModality: (input: unknown) => void;
        }
      ).assertZoomLinkModality({
        modality: AppointmentModality.CALL,
        zoomLink: 'https://zoom.us/j/123456789',
      }),
    ).toThrow(BadRequestException);
  });

  it('allows a Zoom link for a video call', () => {
    expect(() =>
      (
        service as unknown as {
          assertZoomLinkModality: (input: unknown) => void;
        }
      ).assertZoomLinkModality({
        modality: AppointmentModality.VIDEO_CALL,
        zoomLink: 'https://zoom.us/j/123456789',
      }),
    ).not.toThrow();
  });

  it('allows staff to move an appointment to another active volunteer', async () => {
    const service = Object.create(
      PsychooncologyAppointmentsService.prototype,
    ) as PsychooncologyAppointmentsService;
    const nextAvailability = {
      id: 'new-slot',
      volunteerId: 'new-volunteer',
      date: '2099-01-01',
      startTime: '10:00:00',
      status: AvailabilityStatus.AVAILABLE,
    };
    const currentAvailability = {
      id: 'old-slot',
      volunteerId: 'old-volunteer',
      status: AvailabilityStatus.RESERVED,
    };
    const lockAvailability = jest
      .fn()
      .mockResolvedValueOnce(nextAvailability)
      .mockResolvedValueOnce(currentAvailability);
    const availabilityRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    const volunteerRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'new-volunteer',
        isActive: true,
      }),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Volunteer ? volunteerRepository : availabilityRepository,
      ),
    };
    (
      service as unknown as { lockAvailability: typeof lockAvailability }
    ).lockAvailability = lockAvailability;

    const appointment = {
      availabilityId: 'old-slot',
      volunteerId: 'old-volunteer',
      scheduledAt: new Date('2098-01-01T10:00:00Z'),
    } as PsychooncologyAppointment;
    const reschedule = (
      service as unknown as {
        rescheduleAppointment: (
          manager: unknown,
          appointment: PsychooncologyAppointment,
          nextAvailabilityId: string,
          user: unknown,
        ) => Promise<void>;
      }
    ).rescheduleAppointment.bind(service);

    await reschedule(manager, appointment, 'new-slot', {
      role: UserRole.AGENT,
    });

    expect(appointment.volunteerId).toBe('new-volunteer');
    expect(appointment.availabilityId).toBe('new-slot');
    expect(appointment.scheduledAt).toEqual(new Date('2099-01-01T10:00:00Z'));
    expect(availabilityRepository.save).toHaveBeenCalledTimes(2);
  });

  it('prevents a volunteer from moving an appointment to another volunteer', async () => {
    const service = Object.create(
      PsychooncologyAppointmentsService.prototype,
    ) as PsychooncologyAppointmentsService;
    const lockAvailability = jest.fn().mockResolvedValue({
      id: 'new-slot',
      volunteerId: 'other-volunteer',
      date: '2099-01-01',
      startTime: '10:00:00',
      status: AvailabilityStatus.AVAILABLE,
    });
    const volunteerRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'other-volunteer',
        isActive: true,
      }),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(volunteerRepository),
    };
    Object.assign(service, {
      lockAvailability,
      access: {
        volunteerIdFor: jest.fn().mockResolvedValue('own-volunteer'),
      },
    });

    const reschedule = (
      service as unknown as {
        rescheduleAppointment: (
          manager: unknown,
          appointment: PsychooncologyAppointment,
          nextAvailabilityId: string,
          user: unknown,
        ) => Promise<void>;
      }
    ).rescheduleAppointment.bind(service);

    await expect(
      reschedule(
        manager,
        {
          availabilityId: 'old-slot',
          volunteerId: 'own-volunteer',
          status: AppointmentStatus.SCHEDULED,
        } as PsychooncologyAppointment,
        'new-slot',
        { role: UserRole.VOLUNTEER },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_ANSWER,
    AppointmentStatus.CANCELLED,
  ])('only lets volunteers record a %s result', (status) => {
    const assertTransition = (
      service as unknown as {
        assertTransition: (
          appointment: PsychooncologyAppointment,
          input: { status: AppointmentStatus },
          user: { role: UserRole },
        ) => void;
      }
    ).assertTransition.bind(service);

    expect(() =>
      assertTransition(
        { status: AppointmentStatus.SCHEDULED } as PsychooncologyAppointment,
        { status },
        { role: UserRole.AGENT },
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows volunteers to cancel their own appointment', () => {
    const assertTransition = (
      service as unknown as {
        assertTransition: (
          appointment: PsychooncologyAppointment,
          input: { status: AppointmentStatus },
          user: { role: UserRole },
        ) => void;
      }
    ).assertTransition.bind(service);

    expect(() =>
      assertTransition(
        { status: AppointmentStatus.SCHEDULED } as PsychooncologyAppointment,
        { status: AppointmentStatus.CANCELLED },
        { role: UserRole.VOLUNTEER },
      ),
    ).not.toThrow();
  });

  it('requires a linked companion for companion sessions', async () => {
    const resolveBeneficiary = (
      service as unknown as {
        resolveBeneficiary: (
          manager: unknown,
          patientId: string,
          beneficiaryType: AppointmentBeneficiaryType | undefined,
          companionId: string | null | undefined,
        ) => Promise<unknown>;
      }
    ).resolveBeneficiary.bind(service);

    await expect(
      resolveBeneficiary(
        {},
        'patient-1',
        AppointmentBeneficiaryType.COMPANION,
        undefined,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('normalizes patient sessions without a companion', async () => {
    const resolveBeneficiary = (
      service as unknown as {
        resolveBeneficiary: (
          manager: unknown,
          patientId: string,
          beneficiaryType: AppointmentBeneficiaryType | undefined,
          companionId: string | null | undefined,
        ) => Promise<unknown>;
      }
    ).resolveBeneficiary.bind(service);

    await expect(
      resolveBeneficiary(
        {},
        'patient-1',
        AppointmentBeneficiaryType.PATIENT,
        null,
      ),
    ).resolves.toEqual({
      beneficiaryType: AppointmentBeneficiaryType.PATIENT,
      companionId: null,
      companion: null,
    });
  });
});
