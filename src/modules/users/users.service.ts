import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { EntityManager, Not, Repository } from 'typeorm';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { Volunteer } from '../../database/entities/volunteer.entity';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: this.normalizeEmail(email) },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAll(
    filters: ListUsersDto,
    requester?: User,
  ): Promise<{ data: User[]; total: number }> {
    if (
      requester &&
      requester.role !== UserRole.ADMIN &&
      filters.role !== UserRole.FOUNDATION
    ) {
      throw new ForbiddenException(
        'Only administrators can list users without a foundation role filter',
      );
    }

    const [data, total] = await this.usersRepository.findAndCount({
      where: filters.role ? { role: filters.role } : undefined,
      order: { createdAt: 'DESC' },
      skip: filters.offset,
      take: filters.limit,
    });
    return { data, total };
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

  async update(id: string, input: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Los administradores no son editables');
    }

    if (input.email !== undefined) {
      const email = this.normalizeEmail(input.email);
      if (email !== user.email) {
        const existingUser = await this.usersRepository.findOne({
          where: { email, id: Not(id) },
        });
        if (existingUser) {
          throw new ConflictException('Email already exists');
        }
        user.email = email;
        if (user.role === UserRole.VOLUNTEER) {
          await this.volunteersRepository.update({ userId: id }, { email });
        }
      }
    }

    if (input.password !== undefined) {
      user.passwordHash = await bcrypt.hash(input.password, 12);
    }

    if (input.isActive !== undefined) {
      user.isActive = input.isActive;
    }

    return this.usersRepository.save(user);
  }

  async updateEmail(id: string, email: string): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Los administradores no son editables');
    }

    const normalized = this.normalizeEmail(email);
    if (normalized === user.email) {
      return user;
    }

    const existingUser = await this.usersRepository.findOne({
      where: { email: normalized, id: Not(id) },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    user.email = normalized;
    return this.usersRepository.save(user);
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
