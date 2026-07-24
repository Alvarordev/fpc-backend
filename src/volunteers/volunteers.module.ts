import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Volunteer } from '../database/entities/volunteer.entity';
import { UsersModule } from '../users/users.module';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';
@Module({
  imports: [TypeOrmModule.forFeature([Volunteer]), UsersModule],
  controllers: [VolunteersController],
  providers: [VolunteersService],
})
export class VolunteersModule {}
