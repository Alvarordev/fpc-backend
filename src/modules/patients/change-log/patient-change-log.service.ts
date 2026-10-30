import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeLog } from '../../../database/entities/change-log.entity';
import { User } from '../../../database/entities/user.entity';
import { PatientsService } from '../patients.service';
import { ChangeLogQueryDto } from './dto/change-log-query.dto';
import { ChangeLogPageResponseDto } from './dto/change-log-response.dto';

@Injectable()
export class PatientChangeLogService {
  constructor(
    @InjectRepository(ChangeLog)
    private readonly changeLog: Repository<ChangeLog>,
    private readonly patients: PatientsService,
  ) {}

  async findForPatient(
    patientId: string,
    query: ChangeLogQueryDto,
    user: User,
  ): Promise<ChangeLogPageResponseDto> {
    await this.patients.assertCanRead(patientId, user);
    const builder = this.changeLog
      .createQueryBuilder('change')
      .leftJoin(User, 'actor', 'actor.id = change.actor_user_id')
      .addSelect('actor.email', 'actor_email')
      .where('change.patient_id = :patientId', { patientId })
      .orderBy('change.changed_at', 'DESC')
      .addOrderBy('change.id', 'DESC');
    if (query.followUpId)
      builder.andWhere('change.follow_up_id = :followUpId', {
        followUpId: query.followUpId,
      });

    const total = await builder.getCount();
    const { entities, raw } = await builder
      .offset(query.offset ?? 0)
      .limit(query.limit ?? 100)
      .getRawAndEntities<{ actor_email: string | null }>();
    return {
      total,
      items: entities.map((entry, index) => ({
        ...entry,
        actorEmail: raw[index]?.actor_email ?? null,
      })),
    };
  }
}
