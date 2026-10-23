import 'dotenv/config';
import dataSource from '../data-source';
import { ensureAdminUser } from './admin-user';
import { resetDomainTables } from './demo/reset';
import {
  seedCatalogItems,
  seedStagingHealthCenters,
  seedUbigeo,
} from './staging/seed-reference-data';
import { ensureSystemVolunteer } from './system-volunteer';

/**
 * Destructive reset for staging marcha blanca:
 * wipe domain data, restore infra rows, one admin, system volunteer,
 * hospitals, catalogs, and ubigeo. No demo patients or agents.
 */
async function seedStaging(): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.SEED_STAGING_FORCE
  ) {
    throw new Error(
      'Refusing to run the staging seed with NODE_ENV=production — it deletes all data. Set SEED_STAGING_FORCE=true to override.',
    );
  }

  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      await resetDomainTables(manager);
      const admin = await ensureAdminUser(manager);
      await ensureSystemVolunteer(manager);
      const healthCenters = await seedStagingHealthCenters(manager);
      const catalogCount = await seedCatalogItems(manager);
      const ubigeo = await seedUbigeo(manager);

      console.log('\nStaging seed OK:\n');
      console.log(`  admin                 ${admin.email}`);
      console.log(
        `  health_centers        ${String(healthCenters.length).padStart(4)}`,
      );
      console.log(
        `  catalog_items         ${String(catalogCount).padStart(4)}`,
      );
      console.log(
        `  ubigeo_departments    ${String(ubigeo.departments).padStart(4)}`,
      );
      console.log(
        `  ubigeo_provinces      ${String(ubigeo.provinces).padStart(4)}`,
      );
      console.log(
        `  ubigeo_districts      ${String(ubigeo.districts).padStart(4)}`,
      );
      console.log('');
    });
  } finally {
    await dataSource.destroy();
  }
}

void seedStaging().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
