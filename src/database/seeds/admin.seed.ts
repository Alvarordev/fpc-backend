import 'dotenv/config';
import dataSource from '../data-source';
import { ensureAdminUser } from './admin-user';

async function seedAdmin(): Promise<void> {
  await dataSource.initialize();

  try {
    await ensureAdminUser(dataSource.manager);
  } finally {
    await dataSource.destroy();
  }
}

void seedAdmin().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
