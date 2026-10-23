import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Foundation } from '../../database/entities/foundation.entity';
import { UsersModule } from '../users/users.module';
import { FoundationsController } from './foundations.controller';
import { FoundationsService } from './foundations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Foundation]), UsersModule],
  controllers: [FoundationsController],
  providers: [FoundationsService],
})
export class FoundationsModule {}
