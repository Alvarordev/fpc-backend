import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatalogItem } from '../../database/entities/catalog-item.entity';
import {
  UbigeoDepartment,
  UbigeoDistrict,
  UbigeoProvince,
} from '../../database/entities/ubigeo.entity';
import { CatalogsService } from './catalogs.service';

describe('CatalogsService', () => {
  const catalogItems = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value: Partial<CatalogItem>) => value),
    save: jest.fn((value: CatalogItem) =>
      Promise.resolve({
        id: value.id ?? 'item-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...value,
      }),
    ),
  };

  const departments = { createQueryBuilder: jest.fn() };
  const provinces = { createQueryBuilder: jest.fn() };
  const districts = { createQueryBuilder: jest.fn() };

  let service: CatalogsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CatalogsService,
        { provide: getRepositoryToken(CatalogItem), useValue: catalogItems },
        {
          provide: getRepositoryToken(UbigeoDepartment),
          useValue: departments,
        },
        { provide: getRepositoryToken(UbigeoProvince), useValue: provinces },
        { provide: getRepositoryToken(UbigeoDistrict), useValue: districts },
      ],
    }).compile();

    service = module.get(CatalogsService);
  });

  it('creates a non-system catalog item', async () => {
    catalogItems.findOne.mockResolvedValue(null);

    const created = await service.create({
      kind: 'native_language',
      code: 'WAMPIS',
      label: 'Wampís',
    });

    expect(created.code).toBe('WAMPIS');
    expect(created.isSystem).toBe(false);
    expect(catalogItems.save).toHaveBeenCalled();
  });

  it('rejects duplicate kind+code', async () => {
    catalogItems.findOne.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create({
        kind: 'native_language',
        code: 'QUECHUA',
        label: 'Quechua',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to archive system items', async () => {
    catalogItems.findOne.mockResolvedValue({
      id: 'stage-1',
      isSystem: true,
      isActive: true,
    });

    await expect(service.archive('stage-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('archives non-system items', async () => {
    catalogItems.findOne
      .mockResolvedValueOnce({
        id: 'lang-1',
        isSystem: false,
        isActive: true,
      })
      .mockResolvedValueOnce({
        id: 'lang-1',
        isSystem: false,
        isActive: false,
      });

    const archived = await service.archive('lang-1');
    expect(archived.isActive).toBe(false);
  });

  it('throws when item is missing', async () => {
    catalogItems.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
