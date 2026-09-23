import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { translateEnrollmentQueryError } from './enrollment-db-error';

function failed(driverError: {
  code: string;
  constraint?: string;
  table?: string;
}) {
  return new QueryFailedError('INSERT', [], driverError);
}

describe('translateEnrollmentQueryError', () => {
  it('maps the patient DNI unique constraint', () => {
    const error = translateEnrollmentQueryError(
      failed({
        code: '23505',
        constraint: 'UQ_b09e471222674eb27a9ed8881b6',
        table: 'patients',
      }),
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect(error?.getResponse()).toEqual(
      expect.objectContaining({ code: 'PATIENT_DNI_EXISTS' }),
    );
  });

  it('maps other unique, foreign key, not-null, and check failures', () => {
    expect(
      translateEnrollmentQueryError(
        failed({ code: '23505', constraint: 'UQ_other' }),
      )?.getResponse(),
    ).toEqual(
      expect.objectContaining({
        code: 'UNIQUE_VIOLATION',
        message: 'Ya existe un registro con esos datos.',
      }),
    );
    expect(
      translateEnrollmentQueryError(failed({ code: '23503' })),
    ).toBeInstanceOf(BadRequestException);
    expect(
      translateEnrollmentQueryError(failed({ code: '23502' }))?.getResponse(),
    ).toEqual(expect.objectContaining({ code: 'NOT_NULL_VIOLATION' }));
    expect(
      translateEnrollmentQueryError(failed({ code: '23514' }))?.getResponse(),
    ).toEqual(expect.objectContaining({ code: 'CHECK_VIOLATION' }));
  });

  it('leaves unknown database errors and http exceptions untouched', () => {
    expect(translateEnrollmentQueryError(failed({ code: '40P01' }))).toBeNull();
    expect(
      translateEnrollmentQueryError(new BadRequestException('no')),
    ).toBeNull();
    expect(
      JSON.stringify(
        translateEnrollmentQueryError(
          failed({ code: '23503', constraint: 'FK_secret', table: 'patients' }),
        )?.getResponse(),
      ),
    ).not.toContain('FK_secret');
  });
});
