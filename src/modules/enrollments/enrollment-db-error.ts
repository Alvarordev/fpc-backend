import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
  isPatientDniUniqueViolation,
  patientDniConflict,
} from '../patients/patient-dni-conflict';

export type EnrollmentDbDriverError = {
  code?: string;
  constraint?: string;
  table?: string;
};

export function enrollmentDbDriverError(
  error: QueryFailedError,
): EnrollmentDbDriverError {
  return error.driverError as EnrollmentDbDriverError;
}

export function translateEnrollmentQueryError(
  error: unknown,
): BadRequestException | ConflictException | null {
  if (!(error instanceof QueryFailedError)) return null;
  if (isPatientDniUniqueViolation(error)) return patientDniConflict();

  const driver = enrollmentDbDriverError(error);
  switch (driver.code) {
    case '23505':
      return new ConflictException({
        code: 'UNIQUE_VIOLATION',
        message: 'Ya existe un registro con esos datos.',
      });
    case '23503':
      return new BadRequestException({
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Una referencia del enrolamiento no existe.',
      });
    case '23502':
      return new BadRequestException({
        code: 'NOT_NULL_VIOLATION',
        message: 'Falta un dato obligatorio del enrolamiento.',
      });
    case '23514':
      return new BadRequestException({
        code: 'CHECK_VIOLATION',
        message: 'Algún dato del enrolamiento no cumple las reglas.',
      });
    default:
      return null;
  }
}
