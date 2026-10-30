import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  CatalogItem,
  type CatalogKind,
} from '../../../database/entities/catalog-item.entity';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { HealthCenter } from '../../../database/entities/health-center.entity';
import { PatientDetails } from '../../../database/entities/patient-details.entity';
import { PatientInsurance } from '../../../database/entities/patient-insurance.entity';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import {
  PatientSocialReferral,
  SocialReferralStatus,
  SocialReferralType,
} from '../../../database/entities/patient-social-referral.entity';
import { PatientSocialReferralUpdate } from '../../../database/entities/patient-social-referral-update.entity';
import { User } from '../../../database/entities/user.entity';
import { dateOnlyInLima } from '../../../shared/date-only/date-only.util';
import { CatalogValueService } from '../../catalogs/catalog-value.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { PatientsService } from '../patients.service';
import { CreatePatientSocialReferralDto } from './dto/create-patient-social-referral.dto';
import { CreatePatientSocialReferralUpdateDto } from './dto/create-patient-social-referral-update.dto';

export const SOCIAL_REFERRAL_OUTCOME_KIND: Record<
  SocialReferralType,
  CatalogKind
> = {
  [SocialReferralType.COMPLAINT]: 'complaint_outcome',
  [SocialReferralType.SOCIAL_WORKER]: 'social_worker_outcome',
  [SocialReferralType.FISSAL]: 'fissal_outcome',
  [SocialReferralType.CONADIS]: 'conadis_outcome',
};

/** CONADIS outcome that means the patient now has the disability card. */
const CONADIS_CARD_OBTAINED = 'OBTAINED';

@Injectable()
export class PatientSocialReferralsService {
  constructor(
    @InjectRepository(PatientSocialReferral)
    private readonly repository: Repository<PatientSocialReferral>,
    private readonly dataSource: DataSource,
    private readonly patients: PatientsService,
    private readonly catalogValues: CatalogValueService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

  async findAll(
    patientId: string,
    user: User,
  ): Promise<PatientSocialReferral[]> {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      relations: { healthCenter: true, updates: true },
      order: { openedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(
    patientId: string,
    input: CreatePatientSocialReferralDto,
    authorId: string,
  ): Promise<PatientSocialReferral> {
    const id = await this.dataSource.transaction(async (manager) => {
      await this.patients.assertPatientRole(
        patientId,
        PatientRole.PATIENT,
        undefined,
        manager,
      );
      await this.assertFollowUp(manager, patientId, input.followUpId);

      const insuranceType = await this.currentInsuranceType(manager, patientId);
      let complaintChannel: string | null = null;
      if (input.type === SocialReferralType.COMPLAINT) {
        const channel = await this.catalogValues.resolve(
          'complaint_channel',
          input.complaintChannel ?? '',
          { manager },
        );
        const allowed = await this.channelInsuranceTypes(manager, channel.code);
        if (allowed && (!insuranceType || !allowed.includes(insuranceType)))
          throw new BadRequestException(
            `${channel.label} solo aplica a pacientes con seguro ${allowed.join(' o ')}.`,
          );
        if (
          !(await manager
            .getRepository(HealthCenter)
            .existsBy({ id: input.healthCenterId }))
        )
          throw new NotFoundException('Health center not found');
        complaintChannel = channel.code;
      }
      if (input.type === SocialReferralType.FISSAL && insuranceType !== 'SIS')
        throw new BadRequestException(
          'FISSAL solo aplica a pacientes con seguro SIS.',
        );
      if (input.type === SocialReferralType.CONADIS) {
        const details = await manager
          .getRepository(PatientDetails)
          .findOneBy({ patientId });
        if (details?.hasConadisCard)
          throw new BadRequestException('El paciente ya tiene carnet CONADIS.');
      }

      const isComplaint = input.type === SocialReferralType.COMPLAINT;
      const repository = manager.getRepository(PatientSocialReferral);
      const saved = await repository.save(
        repository.create({
          patientId,
          type: input.type,
          complaintChannel,
          healthCenterId: isComplaint ? input.healthCenterId : null,
          issue: isComplaint ? (input.issue?.trim() ?? null) : null,
          note: input.note?.trim() || null,
          status: SocialReferralStatus.OPEN,
          openedAt: input.openedAt ?? dateOnlyInLima(new Date()),
          followUpId: input.followUpId,
          createdById: authorId,
        }),
      );
      await this.invalidations.markDirty(patientId, manager);
      return saved.id;
    });
    return this.findOne(patientId, id);
  }

  async addUpdate(
    patientId: string,
    referralId: string,
    input: CreatePatientSocialReferralUpdateDto,
    authorId: string,
  ): Promise<PatientSocialReferral> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PatientSocialReferral);
      const referral = await repository.findOneBy({
        id: referralId,
        patientId,
      });
      if (!referral) throw new NotFoundException('Referral not found');
      await this.assertFollowUp(manager, patientId, input.followUpId);

      const kind = SOCIAL_REFERRAL_OUTCOME_KIND[referral.type];
      const outcome = await this.catalogValues.resolve(kind, input.outcome, {
        manager,
      });
      const item = await manager
        .getRepository(CatalogItem)
        .findOneBy({ kind, code: outcome.code });
      // Outcomes close the case unless the catalog marks them as still open
      // (no information yet, patient unreachable); new options are final.
      const closes = item?.metadata?.closesReferral !== false;

      await manager.getRepository(PatientSocialReferralUpdate).save({
        referralId,
        followUpId: input.followUpId,
        outcome: outcome.code,
        note: input.note?.trim() || null,
        authorId,
      });
      // The latest outcome decides the state, so a later check can reopen it.
      referral.status = closes
        ? SocialReferralStatus.CLOSED
        : SocialReferralStatus.OPEN;
      referral.closedAt = closes ? dateOnlyInLima(new Date()) : null;
      await repository.save(referral);

      if (
        referral.type === SocialReferralType.CONADIS &&
        outcome.code === CONADIS_CARD_OBTAINED
      )
        await manager
          .getRepository(PatientDetails)
          .update({ patientId }, { hasConadisCard: true });
      await this.invalidations.markDirty(patientId, manager);
    });
    return this.findOne(patientId, referralId);
  }

  private async findOne(
    patientId: string,
    id: string,
  ): Promise<PatientSocialReferral> {
    return this.repository.findOneOrFail({
      where: { id, patientId },
      relations: { healthCenter: true, updates: true },
    });
  }

  private async assertFollowUp(
    manager: EntityManager,
    patientId: string,
    followUpId: string,
  ): Promise<void> {
    if (
      !(await manager
        .getRepository(FollowUp)
        .existsBy({ id: followUpId, subjectPatientId: patientId }))
    )
      throw new NotFoundException('Follow-up not found');
  }

  private async currentInsuranceType(
    manager: EntityManager,
    patientId: string,
  ): Promise<string | null> {
    const insurance = await manager
      .getRepository(PatientInsurance)
      .findOneBy({ patientId, isCurrent: true });
    return insurance?.insuranceType ?? null;
  }

  private async channelInsuranceTypes(
    manager: EntityManager,
    code: string,
  ): Promise<string[] | null> {
    const item = await manager
      .getRepository(CatalogItem)
      .findOneBy({ kind: 'complaint_channel', code });
    const types = item?.metadata?.insuranceTypes;
    return Array.isArray(types) && types.length
      ? types.filter((type): type is string => typeof type === 'string')
      : null;
  }
}
