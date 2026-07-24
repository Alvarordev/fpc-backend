import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { EntityManager, Repository } from 'typeorm';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: this.normalizeEmail(email) },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(input: {
    email: string;
    password: string;
    role: UserRole;
  }): Promise<User> {
    return this.createWithManager(input, this.usersRepository.manager);
  }

  async createWithManager(
    input: {
      email: string;
      password: string;
      role: UserRole;
    },
    manager: EntityManager,
  ): Promise<User> {
    const email = this.normalizeEmail(input.email);
    const usersRepository = manager.getRepository(User);
    const existingUser = await usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = usersRepository.create({
      email,
      passwordHash,
      role: input.role,
    });

    return usersRepository.save(user);
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = isActive;
    return this.usersRepository.save(user);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
