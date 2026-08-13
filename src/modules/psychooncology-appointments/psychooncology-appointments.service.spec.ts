import { ConflictException } from '@nestjs/common';
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
});
