const dataSource = require('../dist/database/data-source.js').default;

async function run() {
  try {
    await dataSource.initialize();
    const migrations = await dataSource.runMigrations({ transaction: 'all' });

    if (migrations.length === 0) {
      console.log('No hay migraciones pendientes.');
    } else {
      for (const migration of migrations) {
        console.log(`Migración ejecutada: ${migration.name}`);
      }
    }
  } catch (error) {
    console.error('No se pudieron ejecutar las migraciones.');
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void run();
