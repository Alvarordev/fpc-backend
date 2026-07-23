import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import { UserRole } from '../entities/user-role.enum';
import { User } from '../entities/user.entity';

async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
  }

  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters long');
  }

  await dataSource.initialize();

  try {
    const users = dataSource.getRepository(User);
    const existingUser = await users.findOne({ where: { email } });

    if (existingUser) {
      return;
    }

    await users.save(
      users.create({
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: UserRole.ADMIN,
      }),
    );
  } finally {
    await dataSource.destroy();
  }
}

void seedAdmin().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
