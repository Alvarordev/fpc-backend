import { BadRequestException } from '@nestjs/common';
import { LodgingCostPeriod } from '../../../database/entities/lodging-cost-period.enum';
import { DurationUnit } from '../../../database/entities/duration-unit.enum';
import type { CatalogValueService } from '../../catalogs/catalog-value.service';
import { PatientAddressesService } from './patient-addresses.service';

function service() {
  const catalogValues = {
    resolveOptional: jest.fn(
      (
        _kind: string,
        value: string | null,
        options?: { otherText?: string | null },
      ) =>
        Promise.resolve(
          value
            ? { code: value, label: value, other: options?.otherText ?? null }
            : null,
        ),
    ),
  } as unknown as CatalogValueService;
  return new PatientAddressesService(
    null as never,
    null as never,
    null as never,
    null as never,
    catalogValues,
  );
}

describe('PatientAddressesService.normalize', () => {
  it('stores the lodging answers with their catalog codes', async () => {
    await expect(
      service().normalize({
        housingType: 'LODGING',
        travelTimeToHospital: { valueMin: 30, unit: DurationUnit.MINUTE },
        averageLodgingCost: 45.5,
        averageLodgingCostPeriod: LodgingCostPeriod.NIGHT,
        locationShareStatus: 'OTRO',
        locationShareStatusOther: 'Lo enviará luego',
      }),
    ).resolves.toMatchObject({
      housingType: 'LODGING',
      housingTypeOther: null,
      averageLodgingCost: '45.5',
      averageLodgingCostPeriod: LodgingCostPeriod.NIGHT,
      locationShareStatus: 'OTRO',
      locationShareStatusOther: 'Lo enviará luego',
      travelTimeToHospital: { canonicalMinutesMin: 30 },
    });
  });

  it('requires the period of a lodging cost', async () => {
    await expect(
      service().normalize({ averageLodgingCost: 45 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
