import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import {
  PatientSocialNote,
  SocialNoteType,
} from '../../../database/entities/patient-social-note.entity';
import { User } from '../../../database/entities/user.entity';
import { PatientsService } from '../patients.service';
import { CreatePatientSocialNoteDto } from './dto/create-patient-social-note.dto';
import { PatientSocialNotesService } from './patient-social-notes.service';

describe('PatientSocialNotesService', () => {
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  } as unknown as Repository<PatientSocialNote>;
  const followUps = {
    existsBy: jest.fn(),
  } as unknown as Repository<FollowUp>;
  const patients = {
    assertPatientRole: jest.fn(),
    assertCanRead: jest.fn(),
  } as unknown as PatientsService;
  let service: PatientSocialNotesService;

  const input: CreatePatientSocialNoteDto = {
    followUpId: 'follow-up-id',
    type: SocialNoteType.CONADIS,
    note: 'Se actualizo la documentacion.',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (patients.assertPatientRole as jest.Mock).mockResolvedValue(undefined);
    (patients.assertCanRead as jest.Mock).mockResolvedValue(undefined);
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    (repository.create as jest.Mock).mockImplementation((value) => value);
    (repository.save as jest.Mock).mockImplementation(async (value) => ({
      id: 'note-id',
      createdAt: new Date('2026-08-13T12:00:00.000Z'),
      ...value,
    }));
    service = new PatientSocialNotesService(repository, followUps, patients);
  });

  it('uses the authenticated user as the author', async () => {
    await service.create('patient-id', input, 'author-id');

    expect(patients.assertPatientRole).toHaveBeenCalledWith(
      'patient-id',
      PatientRole.PATIENT,
      undefined,
      undefined,
    );
    expect(followUps.existsBy).toHaveBeenCalledWith({
      id: input.followUpId,
      subjectPatientId: 'patient-id',
    });
    expect(repository.create).toHaveBeenCalledWith({
      patientId: 'patient-id',
      followUpId: input.followUpId,
      type: input.type,
      note: input.note,
      authorId: 'author-id',
    });
  });

  it('rejects a follow-up belonging to another patient', async () => {
    (followUps.existsBy as jest.Mock).mockResolvedValue(false);

    await expect(
      service.create('patient-id', input, 'author-id'),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('checks patient read access before listing notes', async () => {
    const user = { id: 'user-id' } as User;
    (repository.find as jest.Mock).mockResolvedValue([]);

    await service.findAll('patient-id', user);

    expect(patients.assertCanRead).toHaveBeenCalledWith('patient-id', user);
    expect(repository.find).toHaveBeenCalledWith({
      where: { patientId: 'patient-id' },
      order: { createdAt: 'DESC' },
    });
  });
});
