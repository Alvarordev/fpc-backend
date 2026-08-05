import * as bcrypt from 'bcrypt';
import type { EntityManager } from 'typeorm';
import { UserRole } from '../entities/user-role.enum';
import { User } from '../entities/user.entity';

/** Same cost factor as `UsersService.create`, so seeded logins behave identically. */
export const BCRYPT_ROUNDS = 12;

/**
 * Creates the admin user from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` if it
 * does not exist yet. Shared by `admin.seed.ts` and `demo.seed.ts`.
 */
export async function ensureAdminUser(manager: EntityManager): Promise<User> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
  }

  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters long');
  }

  const users = manager.getRepository(User);
  const existingUser = await users.findOne({ where: { email } });

  if (existingUser) {
    return existingUser;
  }

  return users.save(
    users.create({
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: UserRole.ADMIN,
    }),
  );
}
