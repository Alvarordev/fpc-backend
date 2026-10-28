import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type DeepPartial, type Repository } from 'typeorm';
import { Companion } from '../../database/entities/companion.entity';

export const COMPANION_DNI_EXISTS = 'COMPANION_DNI_EXISTS';

function companionDniConflict(): ConflictException {
  return new ConflictException({
    code: COMPANION_DNI_EXISTS,
    message:
      'Ya existe un acompañante con este documento. Vincúlalo en lugar de registrarlo de nuevo.',
  });
}

export async function saveCompanionOrDniConflict(
  repository: Repository<Companion>,
  input: DeepPartial<Companion>,
): Promise<Companion> {
  const dni = typeof input.dni === 'string' ? input.dni.trim() : input.dni;
  const normalized = { ...input, dni: dni ? dni : null };
  if (normalized.dni) {
    const existing = await repository.findOne({
      where: { dni: normalized.dni },
    });
    if (existing && existing.id !== normalized.id) throw companionDniConflict();
  }
  try {
    return await repository.save(repository.create(normalized));
  } catch (error) {
    const driver =
      error instanceof QueryFailedError
        ? (error.driverError as { code?: string; constraint?: string })
        : null;
    if (driver?.code === '23505' && driver.constraint === 'UQ_companions_dni')
      throw companionDniConflict();
    throw error;
  }
}
