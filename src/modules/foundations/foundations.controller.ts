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
import { Foundation } from '../../database/entities/foundation.entity';
import { FoundationResponseDto } from './dto/foundation-response.dto';
import { FoundationsService } from './foundations.service';
import { CreateFoundationDto } from './dto/create-foundation.dto';
import { UpdateFoundationDto } from './dto/update-foundation.dto';

@Controller('foundations')
@ApiBearerAuth()
@ApiTags('foundations')
@ApiUnauthorizedResponse({ description: 'JWT missing, invalid, or expired' })
export class FoundationsController {
  constructor(private readonly foundationsService: FoundationsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a foundation profile' })
  @ApiCreatedResponse({ type: FoundationResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  create(@Body() input: CreateFoundationDto) {
    return this.foundationsService.create(input).then(this.toResponse);
  }

  @Get()
  @ApiOperation({ summary: 'List foundation profiles' })
  @ApiOkResponse({ type: FoundationResponseDto, isArray: true })
  findAll() {
    return this.foundationsService
      .findAll()
      .then((items) => items.map(this.toResponse));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a foundation profile' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FoundationResponseDto })
  @ApiNotFoundResponse({ description: 'Foundation profile not found' })
  findOne(@Param('id') id: string) {
    return this.foundationsService.findById(id).then(this.toResponse);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a foundation profile' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FoundationResponseDto })
  @ApiForbiddenResponse({ description: 'Administrator role required' })
  @ApiNotFoundResponse({ description: 'Foundation profile not found' })
  update(@Param('id') id: string, @Body() input: UpdateFoundationDto) {
    return this.foundationsService.update(id, input).then(this.toResponse);
  }

  private toResponse(this: void, foundation: Foundation): FoundationResponseDto {
    return {
      id: foundation.id,
      userId: foundation.userId,
      firstName: foundation.firstName,
      lastName: foundation.lastName,
      email: foundation.user.email,
      phone: foundation.phone,
      isActive: foundation.user.isActive,
      createdAt: foundation.createdAt,
    };
  }
}
