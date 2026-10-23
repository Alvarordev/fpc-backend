import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { PatientSocialNote } from '../../../database/entities/patient-social-note.entity';
import { User } from '../../../database/entities/user.entity';
import { CreatePatientSocialNoteDto } from './dto/create-patient-social-note.dto';
import { PatientsService } from '../patients.service';

@Injectable()
export class PatientSocialNotesService {
  constructor(
    @InjectRepository(PatientSocialNote)
    private readonly repository: Repository<PatientSocialNote>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    private readonly patients: PatientsService,
  ) {}

  async create(
    patientId: string,
    input: CreatePatientSocialNoteDto,
    authorId: string,
    manager?: EntityManager,
  ): Promise<PatientSocialNote> {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );

    const followUps = manager?.getRepository(FollowUp) ?? this.followUps;
    if (
      !(await followUps.existsBy({
        id: input.followUpId,
        subjectPatientId: patientId,
      }))
    ) {
      throw new NotFoundException('Follow-up not found');
    }

    const repository =
      manager?.getRepository(PatientSocialNote) ?? this.repository;
    return repository.save(
      repository.create({
        patientId,
        followUpId: input.followUpId,
        type: input.type,
        note: input.note,
        authorId,
      }),
    );
  }

  async findAll(patientId: string, user: User): Promise<PatientSocialNote[]> {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
