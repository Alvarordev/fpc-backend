import { BadRequestException, ConflictException } from '@nestjs/common';
import { AppointmentModality } from '../../database/entities/psychooncology-appointment.entity';
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
});
