import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from '../../modules/patients/dto/create-patient.dto';

async function dniErrors(input: Record<string, unknown>) {
  const dto = plainToInstance(CreatePatientDto, {
    fullName: 'Paciente',
    primaryPhone: '999888777',
    ...input,
  });
  const errors = await validate(dto);
  return errors.filter((error) => error.property === 'dni');
}

describe('MatchesIdentityDocumentType', () => {
  it.each([
    ['DNI', '12345678'],
    ['CE', '123456789'],
    ['CPP', '987654321'],
  ])('accepts a %s with the right number of digits', async (type, dni) => {
    await expect(dniErrors({ documentType: type, dni })).resolves.toEqual([]);
  });

  it.each([
    ['DNI', '1234567'],
    ['DNI', '1234567A'],
    ['CE', '12345678'],
  ])('rejects a %s numbered %s', async (type, dni) => {
    const errors = await dniErrors({ documentType: type, dni });
    expect(errors).toHaveLength(1);
  });

  it('accepts any number when the type is not given', async () => {
    await expect(dniErrors({ dni: 'X-123' })).resolves.toEqual([]);
  });
});
