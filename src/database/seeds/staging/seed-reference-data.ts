import type { EntityManager } from 'typeorm';
import { CatalogItem } from '../../entities/catalog-item.entity';
import {
  UbigeoDepartment,
  UbigeoDistrict,
  UbigeoProvince,
} from '../../entities/ubigeo.entity';
import { HealthCenter } from '../../entities/health-center.entity';
import { CATALOG_ITEM_SEEDS } from './catalog-items';
import { STAGING_HEALTH_CENTERS } from './health-centers';
import {
  UBIGEO_DEPARTMENTS,
  UBIGEO_DISTRICTS,
  UBIGEO_PROVINCES,
} from './ubigeo';

export async function seedStagingHealthCenters(
  manager: EntityManager,
): Promise<HealthCenter[]> {
  return manager.save(
    STAGING_HEALTH_CENTERS.map((seed) =>
      manager.create(HealthCenter, {
        name: seed.name,
        slug: seed.slug,
        department: seed.department,
        category: seed.category,
        isActive: seed.isActive ?? true,
      }),
    ),
  );
}

export async function seedCatalogItems(
  manager: EntityManager,
): Promise<number> {
  const items = CATALOG_ITEM_SEEDS.map((seed) =>
    manager.create(CatalogItem, {
      kind: seed.kind,
      code: seed.code,
      label: seed.label,
      parentCode: seed.parentCode ?? null,
      sortOrder: seed.sortOrder ?? 0,
      isActive: true,
      isSystem: seed.isSystem ?? false,
      metadata: null,
    }),
  );
  await manager.save(items);
  return items.length;
}

export async function seedUbigeo(manager: EntityManager): Promise<{
  departments: number;
  provinces: number;
  districts: number;
}> {
  await manager.save(
    UBIGEO_DEPARTMENTS.map((seed) =>
      manager.create(UbigeoDepartment, {
        code: seed.code,
        ineiCode: seed.ineiCode,
        name: seed.name,
        sortOrder: seed.sortOrder,
        isActive: true,
      }),
    ),
  );

  await manager.save(
    UBIGEO_PROVINCES.map((seed, index) =>
      manager.create(UbigeoProvince, {
        ineiCode: seed.ineiCode,
        departmentCode: seed.departmentCode,
        name: seed.name,
        sortOrder: seed.sortOrder ?? index + 1,
        isActive: true,
      }),
    ),
  );

  await manager.save(
    UBIGEO_DISTRICTS.map((seed, index) =>
      manager.create(UbigeoDistrict, {
        ineiCode: seed.ineiCode,
        provinceIneiCode: seed.provinceIneiCode,
        name: seed.name,
        sortOrder: seed.sortOrder ?? index + 1,
        isActive: true,
      }),
    ),
  );

  return {
    departments: UBIGEO_DEPARTMENTS.length,
    provinces: UBIGEO_PROVINCES.length,
    districts: UBIGEO_DISTRICTS.length,
  };
}
