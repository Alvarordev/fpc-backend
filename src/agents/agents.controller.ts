import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Controller('agents')
@ApiBearerAuth()
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}
  @Post() @Roles(UserRole.ADMIN) create(@Body() input: CreateAgentDto) {
    return this.agentsService.create(input);
  }
  @Get() findAll() {
    return this.agentsService.findAll();
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.agentsService.findById(id);
  }
  @Patch(':id') @Roles(UserRole.ADMIN) update(
    @Param('id') id: string,
    @Body() input: UpdateAgentDto,
  ) {
    return this.agentsService.update(id, input);
  }
  @Patch(':id/deactivate') @Roles(UserRole.ADMIN) deactivate(
    @Param('id') id: string,
  ) {
    return this.agentsService.deactivate(id);
  }
}
