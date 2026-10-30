import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Companion } from '../../database/entities/companion.entity';
import { CompanionPatient } from '../../database/entities/companion-patient.entity';
import { CompanionTalkInterest } from '../../database/entities/companion-talk-interest.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { User } from '../../database/entities/user.entity';
import { CatalogValueService } from '../catalogs/catalog-value.service';
import { CatalogsService } from '../catalogs/catalogs.service';
import { PatientAccessService } from '../patients/access/patient-access.service';
import {
  CreateTalkInterestDto,
  FindTalkInterestsDto,
  TalkInterestResponseDto,
} from './dto/talk-interest.dto';

/** Familiar interesado en una charla, tal como lo captura el enrolamiento. */
export type EnrollmentTalkInterestInput = {
  talk: string;
  familyMemberName: string;
  familyMemberPhone?: string;
  familyMemberEmail?: string;
};

const nameKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** CH1: qué acompañantes se interesan en qué charlas. Sin asistencia (CH2). */
@Injectable()
export class TalkInterestsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly catalogValues: CatalogValueService,
    private readonly catalogs: CatalogsService,
    private readonly access: PatientAccessService,
  ) {}

  async findAll(filters: FindTalkInterestsDto, user: User) {
    const query = this.baseQuery()
      .orderBy('interest.createdAt', 'DESC')
      .skip(filters.offset)
      .take(filters.limit);
    if (filters.talk)
      query.andWhere('interest.talk = :talk', { talk: filters.talk });
    if (filters.search?.trim())
      query.andWhere(
        '(companion.fullName ILIKE :search OR patient.fullName ILIKE :search)',
        { search: `%${filters.search.trim()}%` },
      );
    await this.access.scopeQuery(query, 'interest.patient_id', user);
    const [data, total] = await query.getManyAndCount();
    return { data: await this.toResponses(data), total };
  }

  async findForPatient(patientId: string, user: User) {
    await this.access.assertCanRead(patientId, user);
    const companionIds = (
      await this.dataSource
        .getRepository(CompanionPatient)
        .findBy({ patientId })
    ).map((link) => link.companionId);
    if (!companionIds.length) return [];
    const data = await this.baseQuery()
      .where('interest.companion_id IN (:...companionIds)', { companionIds })
      .orderBy('interest.createdAt', 'DESC')
      .getMany();
    return this.toResponses(data);
  }

  async create(
    patientId: string,
    companionId: string,
    input: CreateTalkInterestDto,
    user: User,
  ) {
    await this.access.assertCanRead(patientId, user);
    const id = await this.dataSource.transaction(async (manager) => {
      if (
        !(await manager
          .getRepository(CompanionPatient)
          .existsBy({ patientId, companionId }))
      )
        throw new NotFoundException(
          'El acompañante no está vinculado a este paciente.',
        );
      if (
        input.followUpId &&
        !(await manager
          .getRepository(FollowUp)
          .existsBy({ id: input.followUpId, subjectPatientId: patientId }))
      )
        throw new NotFoundException('No se encontró el seguimiento.');
      const talk = await this.catalogValues.resolve(
        'educational_talk',
        input.talk,
        { manager },
      );
      const repository = manager.getRepository(CompanionTalkInterest);
      if (await repository.existsBy({ companionId, talk: talk.code }))
        throw new ConflictException(
          'Este acompañante ya está registrado como interesado en esa charla.',
        );
      const saved = await repository.save(
        repository.create({
          companionId,
          patientId,
          talk: talk.code,
          followUpId: input.followUpId ?? null,
          createdById: user.id,
        }),
      );
      return saved.id;
    });
    const [response] = await this.toResponses([
      await this.baseQuery().where('interest.id = :id', { id }).getOneOrFail(),
    ]);
    return response;
  }

  async remove(patientId: string, id: string, user: User) {
    await this.access.assertCanRead(patientId, user);
    const result = await this.dataSource
      .getRepository(CompanionTalkInterest)
      .delete({ id, patientId });
    if (!result.affected)
      throw new NotFoundException('No se encontró el interés en la charla.');
  }

  /**
   * Enrolamiento: cada familiar se empareja por nombre con un acompañante del
   * paciente; si no existe, se crea y vincula (sin rol de contacto).
   */
  async recordForEnrollment(
    manager: EntityManager,
    input: {
      patientId: string;
      followUpId: string;
      userId: string;
      interests: EnrollmentTalkInterestInput[];
    },
  ) {
    if (!input.interests.length) return;
    const links = await manager.getRepository(CompanionPatient).find({
      where: { patientId: input.patientId },
      relations: { companion: true },
    });
    const byName = new Map(
      links.map((link) => [nameKey(link.companion.fullName), link.companion]),
    );
    const repository = manager.getRepository(CompanionTalkInterest);
    for (const interest of input.interests) {
      const name = interest.familyMemberName.trim();
      if (!name)
        throw new BadRequestException(
          'Indica el nombre del familiar interesado en la charla.',
        );
      const talk = await this.catalogValues.resolve(
        'educational_talk',
        interest.talk,
        { manager },
      );
      let companion = byName.get(nameKey(name));
      if (!companion) {
        companion = await manager.getRepository(Companion).save(
          manager.getRepository(Companion).create({
            fullName: name,
            primaryPhone: interest.familyMemberPhone?.trim() || null,
            email: interest.familyMemberEmail?.trim() || null,
          }),
        );
        await manager.getRepository(CompanionPatient).save(
          manager.getRepository(CompanionPatient).create({
            companionId: companion.id,
            patientId: input.patientId,
          }),
        );
        byName.set(nameKey(name), companion);
      }
      await repository
        .createQueryBuilder()
        .insert()
        .values({
          companionId: companion.id,
          patientId: input.patientId,
          talk: talk.code,
          followUpId: input.followUpId,
          createdById: input.userId,
        })
        .orIgnore()
        .execute();
    }
  }

  private baseQuery() {
    return this.dataSource
      .getRepository(CompanionTalkInterest)
      .createQueryBuilder('interest')
      .innerJoinAndSelect('interest.companion', 'companion')
      .innerJoinAndSelect('interest.patient', 'patient');
  }

  private async toResponses(interests: CompanionTalkInterest[]) {
    const labels = new Map(
      (await this.catalogs.findAll('educational_talk', true)).map((item) => [
        item.code,
        item.label,
      ]),
    );
    return interests.map((interest) =>
      TalkInterestResponseDto.from(
        interest,
        labels.get(interest.talk) ?? interest.talk,
      ),
    );
  }
}
