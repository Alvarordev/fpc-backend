import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { UsersService } from '../users/users.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentsRepository: Repository<Agent>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}
  create(input: CreateAgentDto): Promise<Agent> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.usersService.createWithManager(
        { email: input.email, password: input.password, role: UserRole.AGENT },
        manager,
      );
      return manager.getRepository(Agent).save(
        manager.getRepository(Agent).create({
          userId: user.id,
          fullName: input.fullName,
          phone: input.phone,
        }),
      );
    });
  }
  findAll(): Promise<Agent[]> {
    return this.agentsRepository.find({ relations: { user: true } });
  }
  async findById(id: string): Promise<Agent> {
    const agent = await this.agentsRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }
  async update(id: string, input: UpdateAgentDto): Promise<Agent> {
    const agent = await this.findById(id);
    Object.assign(agent, input);
    return this.agentsRepository.save(agent);
  }
  async deactivate(id: string): Promise<Agent> {
    const agent = await this.findById(id);
    await this.usersService.setActive(agent.userId, false);
    return this.findById(id);
  }
}
