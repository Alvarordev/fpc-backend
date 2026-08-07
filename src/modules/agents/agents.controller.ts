import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user-role.enum';
import { Agent } from '../../database/entities/agent.entity';
import { AgentResponseDto } from './dto/agent-response.dto';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Controller('agents')
@ApiBearerAuth()
@ApiTags('agents')
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an agent' })
  @ApiCreatedResponse({ type: AgentResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  create(@Body() input: CreateAgentDto) {
    return this.agentsService.create(input).then(this.toResponse);
  }
  @Get()
  @ApiOperation({ summary: 'List agents' })
  @ApiOkResponse({ type: AgentResponseDto, isArray: true })
  findAll() {
    return this.agentsService
      .findAll()
      .then((items) => items.map(this.toResponse));
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get an agent' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AgentResponseDto })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  findOne(@Param('id') id: string) {
    return this.agentsService.findById(id).then(this.toResponse);
  }
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an agent' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AgentResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  update(@Param('id') id: string, @Body() input: UpdateAgentDto) {
    return this.agentsService.update(id, input).then(this.toResponse);
  }
  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate an agent' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AgentResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  deactivate(@Param('id') id: string) {
    return this.agentsService.deactivate(id).then(this.toResponse);
  }

  private toResponse(this: void, agent: Agent): AgentResponseDto {
    return {
      id: agent.id,
      userId: agent.userId,
      fullName: agent.fullName,
      phone: agent.phone,
      createdAt: agent.createdAt,
    };
  }
}
