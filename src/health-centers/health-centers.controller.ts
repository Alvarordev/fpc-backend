import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../database/entities/user-role.enum';
import {
  CreateHealthCenterDto,
  UpdateHealthCenterDto,
} from './health-centers.dto';
import { HealthCentersService } from './health-centers.service';
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];
@Controller('health-centers')
export class HealthCentersController {
  constructor(private readonly service: HealthCentersService) {}
  @Post() @Roles(...WRITE) create(@Body() dto: CreateHealthCenterDto) {
    return this.service.create(dto);
  }
  @Get() findAll(
    @Query('department') department?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.findAll(
      department,
      isActive === undefined ? undefined : isActive === 'true',
    );
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
  @Patch(':id') @Roles(...WRITE) update(
    @Param('id') id: string,
    @Body() dto: UpdateHealthCenterDto,
  ) {
    return this.service.update(id, dto);
  }
}
