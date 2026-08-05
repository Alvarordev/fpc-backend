import * as bcrypt from 'bcrypt';
import type { EntityManager } from 'typeorm';
import { BCRYPT_ROUNDS, ensureAdminUser } from '../admin-user';
import { Agent } from '../../entities/agent.entity';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.enum';
import { Volunteer } from '../../entities/volunteer.entity';

/**
 * Shared password for every seeded account. The e2e suites clean up by email
 * prefix (`e2e-%@example.test`, `p7-%@example.test`), so the demo domain is
 * deliberately different — running the tests must not delete the demo dataset.
 */
export const DEMO_PASSWORD = 'Demo1234!';
export const DEMO_EMAIL_DOMAIN = 'fpc.demo';

interface AgentSeed {
  fullName: string;
  email: string;
  phone: string;
}

const AGENTS: readonly AgentSeed[] = [
  {
    fullName: 'Lucía Ramírez Ochoa',
    email: `agente.lucia@${DEMO_EMAIL_DOMAIN}`,
    phone: '+51 987 111 222',
  },
  {
    fullName: 'Diego Morales Pinto',
    email: `agente.diego@${DEMO_EMAIL_DOMAIN}`,
    phone: '+51 987 333 444',
  },
  {
    fullName: 'Katherine Solís Ayala',
    email: `agente.katherine@${DEMO_EMAIL_DOMAIN}`,
    phone: '+51 987 555 666',
  },
];

interface VolunteerSeed {
  firstName: string;
  lastName: string;
  specialty: string;
  email: string;
  phone: string;
}

const VOLUNTEERS: readonly VolunteerSeed[] = [
  {
    firstName: 'Andrea',
    lastName: 'Cárdenas Ruiz',
    specialty: 'Psicología clínica',
    email: `voluntaria.andrea@${DEMO_EMAIL_DOMAIN}`,
    phone: '+51 986 101 202',
  },
  {
    firstName: 'Renzo',
    lastName: 'Villanueva Soto',
    specialty: 'Psicooncología',
    email: `voluntario.renzo@${DEMO_EMAIL_DOMAIN}`,
    phone: '+51 986 303 404',
  },
  {
    firstName: 'Patricia',
    lastName: 'Núñez Barrantes',
    specialty: 'Terapia familiar',
    email: `voluntaria.patricia@${DEMO_EMAIL_DOMAIN}`,
    phone: '+51 986 505 606',
  },
];

const FOUNDATION_EMAILS = [
  `fundacion.direccion@${DEMO_EMAIL_DOMAIN}`,
  `fundacion.programas@${DEMO_EMAIL_DOMAIN}`,
];

export interface SeededUsers {
  admin: User;
  foundationUsers: User[];
  agents: Agent[];
  agentUsers: User[];
  volunteers: Volunteer[];
  volunteerUsers: User[];
}

export async function seedUsers(manager: EntityManager): Promise<SeededUsers> {
  const admin = await ensureAdminUser(manager);

  // One hash reused across accounts: bcrypt at cost 12 takes ~250ms per call.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  const createUser = (email: string, role: UserRole): User =>
    manager.create(User, { email, passwordHash, role });

  const foundationUsers = await manager.save(
    FOUNDATION_EMAILS.map((email) => createUser(email, UserRole.FOUNDATION)),
  );

  const agentUsers = await manager.save(
    AGENTS.map(({ email }) => createUser(email, UserRole.AGENT)),
  );
  const agents = await manager.save(
    AGENTS.map((seed, index) =>
      manager.create(Agent, {
        userId: agentUsers[index].id,
        fullName: seed.fullName,
        phone: seed.phone,
      }),
    ),
  );

  const volunteerUsers = await manager.save(
    VOLUNTEERS.map(({ email }) => createUser(email, UserRole.VOLUNTEER)),
  );
  const volunteers = await manager.save(
    VOLUNTEERS.map((seed, index) =>
      manager.create(Volunteer, {
        userId: volunteerUsers[index].id,
        firstName: seed.firstName,
        lastName: seed.lastName,
        specialty: seed.specialty,
        email: seed.email,
        phone: seed.phone,
        isActive: true,
      }),
    ),
  );

  return {
    admin,
    foundationUsers,
    agents,
    agentUsers,
    volunteers,
    volunteerUsers,
  };
}
