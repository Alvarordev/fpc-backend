import { BadRequestException } from '@nestjs/common';
import { CatalogItem } from '../../database/entities/catalog-item.entity';
import { CatalogValueService } from './catalog-value.service';

describe('CatalogValueService', () => {
  const items: CatalogItem[] = [
    {
      id: '1',
      kind: 'medical_specialty',
      code: 'ONCOLOGIA_MEDICA',
      label: 'Oncología médica',
      parentCode: null,
      sortOrder: 10,
      isActive: true,
      isSystem: false,
      metadata: { aliases: ['Oncología', 'ONCOLOGY'] },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      kind: 'medical_specialty',
      code: 'MASTOLOGIA',
      label: 'Mastología',
      parentCode: null,
      sortOrder: 25,
      isActive: true,
      isSystem: false,
      metadata: { aliases: ['Mastologia', 'Mastología'] },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '3',
      kind: 'medical_specialty',
      code: 'OTRO',
      label: 'Otra especialidad',
      parentCode: null,
      sortOrder: 900,
      isActive: true,
      isSystem: false,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const service = new CatalogValueService({
    find: jest.fn().mockResolvedValue(items),
  } as never);

  it('resolves by code, label, and alias', async () => {
    await expect(
      service.resolve('medical_specialty', 'ONCOLOGIA_MEDICA'),
    ).resolves.toMatchObject({ code: 'ONCOLOGIA_MEDICA', other: null });
    await expect(
      service.resolve('medical_specialty', 'Oncología médica'),
    ).resolves.toMatchObject({ code: 'ONCOLOGIA_MEDICA' });
    await expect(
      service.resolve('medical_specialty', 'ONCOLOGY'),
    ).resolves.toMatchObject({ code: 'ONCOLOGIA_MEDICA' });
    await expect(
      service.resolve('medical_specialty', 'Mastologia'),
    ).resolves.toMatchObject({ code: 'MASTOLOGIA', other: null });
  });

  it('requires extra text for OTRO', async () => {
    await expect(service.resolve('medical_specialty', 'OTRO')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.resolve('medical_specialty', 'OTRO', { otherText: 'Genética' }),
    ).resolves.toMatchObject({ code: 'OTRO', other: 'Genética' });
  });

  it('rejects unknown values', async () => {
    await expect(
      service.resolve('medical_specialty', 'xyz'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.tryResolve('medical_specialty', 'xyz')).resolves.toBeNull();
  });
});
