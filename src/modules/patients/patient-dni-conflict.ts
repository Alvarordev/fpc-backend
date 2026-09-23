import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type DeepPartial, type Repository } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';

export const PATIENT_DNI_UNIQUE_CONSTRAINT = 'UQ_b09e471222674eb27a9ed8881b6';
export const PATIENT_DNI_EXISTS = 'PATIENT_DNI_EXISTS';

export function patientDniConflict(): ConflictException {
  return new ConflictException({
    code: PATIENT_DNI_EXISTS,
    message: 'Ya existe un paciente con este DNI.',
  });
}

export function isPatientDniUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driver = error.driverError as { code?: string; constraint?: string };
  return (
    driver.code === '23505' &&
    driver.constraint === PATIENT_DNI_UNIQUE_CONSTRAINT
  );
}

export async function savePatientOrDniConflict(
  repository: Repository<Patient>,
  input: DeepPartial<Patient>,
): Promise<Patient> {
  const dni = typeof input.dni === 'string' ? input.dni.trim() : input.dni;
  const normalized = { ...input, dni: dni ? dni : null };
  if (normalized.dni) {
    const existing = await repository.findOne({
      where: { dni: normalized.dni },
    });
    if (existing) throw patientDniConflict();
  }
  try {
    return await repository.save(repository.create(normalized));
  } catch (error) {
    if (isPatientDniUniqueViolation(error)) throw patientDniConflict();
    throw error;
  }
}
