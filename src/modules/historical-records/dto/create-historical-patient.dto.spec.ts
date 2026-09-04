import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from '../../patients/dto/create-patient.dto';
import { CreateHistoricalPatientDto } from './create-historical-patient.dto';

describe('historical patient DTOs', () => {
  it('allows a historical patient without a primary phone', async () => {
    const errors = await validate(
      plainToInstance(CreateHistoricalPatientDto, {
        fullName: 'Paciente Histórico',
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('keeps the primary phone required for operational patients', async () => {
    const errors = await validate(
      plainToInstance(CreatePatientDto, {
        fullName: 'Paciente Operativo',
      }),
    );

    expect(errors.map((error) => error.property)).toContain('primaryPhone');
  });
});
