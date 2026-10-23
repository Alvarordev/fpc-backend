import type { EntityManager } from 'typeorm';
import { UserRole } from '../entities/user-role.enum';
import { User } from '../entities/user.entity';
import { Volunteer } from '../entities/volunteer.entity';

export const SYSTEM_VOLUNTEER_EMAIL = 'voluntario-no-identificado@fpc.system';

/**
 * Placeholder hash — the account is always inactive and cannot log in.
 * Matches the historical-data migration insert.
 */
const SYSTEM_PASSWORD_HASH = '!historical-system-volunteer-disabled!';

/**
 * Anonymous volunteer used when historical psychooncology appointments have
 * no identifiable volunteer. Shared by staging seed, demo seed, and the
 * historical-data migration.
 */
export async function ensureSystemVolunteer(
  manager: EntityManager,
): Promise<Volunteer> {
  const users = manager.getRepository(User);
  const volunteers = manager.getRepository(Volunteer);

  let user = await users.findOne({
    where: { email: SYSTEM_VOLUNTEER_EMAIL },
  });

  if (!user) {
    user = await users.save(
      users.create({
        email: SYSTEM_VOLUNTEER_EMAIL,
        passwordHash: SYSTEM_PASSWORD_HASH,
        role: UserRole.VOLUNTEER,
        isActive: false,
      }),
    );
  } else {
    user.passwordHash = SYSTEM_PASSWORD_HASH;
    user.role = UserRole.VOLUNTEER;
    user.isActive = false;
    await users.save(user);
  }

  let volunteer = await volunteers.findOne({
    where: { isAnonymous: true },
  });

  if (!volunteer) {
    volunteer = await volunteers.findOne({
      where: { email: SYSTEM_VOLUNTEER_EMAIL },
    });
  }

  if (!volunteer) {
    return volunteers.save(
      volunteers.create({
        userId: user.id,
        firstName: 'Voluntario',
        lastName: 'no identificado',
        specialty: 'Sistema',
        email: SYSTEM_VOLUNTEER_EMAIL,
        phone: 'N/A',
        isActive: false,
        isAnonymous: true,
      }),
    );
  }

  volunteer.userId = user.id;
  volunteer.firstName = 'Voluntario';
  volunteer.lastName = 'no identificado';
  volunteer.specialty = 'Sistema';
  volunteer.email = SYSTEM_VOLUNTEER_EMAIL;
  volunteer.phone = 'N/A';
  volunteer.isActive = false;
  volunteer.isAnonymous = true;
  return volunteers.save(volunteer);
}
