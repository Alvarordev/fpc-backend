import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/entities/user-role.enum';
import { CreateEnrollmentDto } from './enrollments.dto';
import { EnrollmentsService } from './enrollments.service';

const READ = [
  UserRole.ADMIN,
  UserRole.FOUNDATION,
  UserRole.AGENT,
  UserRole.VOLUNTEER,
];
const WRITE = [UserRole.ADMIN, UserRole.FOUNDATION, UserRole.AGENT];

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Post() @Roles(...WRITE) create(
    @Body() dto: CreateEnrollmentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.create(dto, user.id, user.role);
  }

  @Get('patient/:patientId') @Roles(...READ) findAll(
    @Param('patientId') patientId: string,
  ) {
    return this.service.findAll(patientId);
  }
}
