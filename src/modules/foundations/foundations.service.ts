import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Foundation } from '../../database/entities/foundation.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { UsersService } from '../users/users.service';
import { CreateFoundationDto } from './dto/create-foundation.dto';
import { UpdateFoundationDto } from './dto/update-foundation.dto';

@Injectable()
export class FoundationsService {
  constructor(
    @InjectRepository(Foundation)
    private readonly foundationsRepository: Repository<Foundation>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}

  create(input: CreateFoundationDto): Promise<Foundation> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.usersService.createWithManager(
        {
          email: input.email,
          password: input.password,
          role: UserRole.FOUNDATION,
        },
        manager,
      );
      return manager.getRepository(Foundation).save(
        manager.getRepository(Foundation).create({
          userId: user.id,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
        }),
      );
    }).then((foundation) => this.findById(foundation.id));
  }

  findAll(): Promise<Foundation[]> {
    return this.foundationsRepository.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Foundation> {
    const foundation = await this.foundationsRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!foundation) throw new NotFoundException('Foundation profile not found');
    return foundation;
  }

  async update(id: string, input: UpdateFoundationDto): Promise<Foundation> {
    const foundation = await this.findById(id);
    Object.assign(foundation, input);
    return this.foundationsRepository.save(foundation);
  }
}
