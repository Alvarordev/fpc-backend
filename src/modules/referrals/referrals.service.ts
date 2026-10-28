import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { HealthCenter } from '../../database/entities/health-center.entity';
import {
  PatientDocument,
  PatientDocumentStatus,
} from '../../database/entities/patient-document.entity';
import { Patient } from '../../database/entities/patient.entity';
import {
  Referral,
  ReferralStatus,
} from '../../database/entities/referral.entity';
import { User } from '../../database/entities/user.entity';
import { CatalogValueService } from '../catalogs/catalog-value.service';
import { PatientAccessService } from '../patients/access/patient-access.service';
import {
  CreateReferralDto,
  UpdateReferralDto,
} from './dto/create-referral.dto';

const RELATIONS = {
  originHealthCenter: true,
  destinationHealthCenter: true,
} as const;

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private readonly referrals: Repository<Referral>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(HealthCenter)
    private readonly healthCenters: Repository<HealthCenter>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(PatientDocument)
    private readonly documents: Repository<PatientDocument>,
    private readonly access: PatientAccessService,
    private readonly catalogValues: CatalogValueService,
  ) {}

  async findAll(patientId: string, user: User, order: 'ASC' | 'DESC') {
    await this.access.assertCanRead(patientId, user);
    return this.referrals.find({
      where: { patientId },
      relations: RELATIONS,
      order: { requestedOn: order, createdAt: order },
    });
  }

  async findOne(patientId: string, id: string, user: User) {
    await this.access.assertCanRead(patientId, user);
    return this.load(patientId, id);
  }

  async create(patientId: string, input: CreateReferralDto) {
    if (!(await this.patients.existsBy({ id: patientId })))
      throw new NotFoundException('No se encontró el paciente.');
    const values = await this.prepare(patientId, {
      status: ReferralStatus.REQUESTED,
      viaSepa: false,
      ...input,
    });
    const saved = await this.referrals.save(
      this.referrals.create({ ...values, patientId }),
    );
    return this.load(patientId, saved.id);
  }

  async update(patientId: string, id: string, input: UpdateReferralDto) {
    const current = await this.load(patientId, id);
    const plain: Partial<Referral> = { ...current };
    delete plain.originHealthCenter;
    delete plain.destinationHealthCenter;
    const values = await this.prepare(
      patientId,
      { ...(plain as CreateReferralDto), ...input },
      id,
    );
    await this.referrals.save(this.referrals.create({ ...plain, ...values }));
    return this.load(patientId, id);
  }

  async remove(patientId: string, id: string) {
    const referral = await this.load(patientId, id);
    await this.referrals.remove(referral);
  }

  private async load(patientId: string, id: string) {
    const referral = await this.referrals.findOne({
      where: { id, patientId },
      relations: RELATIONS,
    });
    if (!referral) throw new NotFoundException('No se encontró la derivación.');
    return referral;
  }

  private async prepare(
    patientId: string,
    input: CreateReferralDto & Partial<Referral>,
    currentId?: string,
  ) {
    const centerIds = [
      input.originHealthCenterId,
      input.destinationHealthCenterId,
    ].filter((value): value is string => Boolean(value));
    if (
      centerIds.length &&
      (await this.healthCenters.countBy({ id: In(centerIds) })) !==
        new Set(centerIds).size
    )
      throw new NotFoundException('No se encontró el establecimiento.');
    if (
      input.originHealthCenterId &&
      input.originHealthCenterId === input.destinationHealthCenterId
    )
      throw new BadRequestException(
        'El origen y el destino deben ser establecimientos distintos.',
      );

    if (
      input.followUpId &&
      !(await this.followUps.existsBy({
        id: input.followUpId,
        subjectPatientId: patientId,
      }))
    )
      throw new NotFoundException('No se encontró el seguimiento.');

    if (input.referralSheetDocumentId) {
      const exists = await this.documents.existsBy({
        id: input.referralSheetDocumentId,
        patientId,
        status: Not(PatientDocumentStatus.ARCHIVED),
      });
      if (!exists)
        throw new NotFoundException('No se encontró la hoja de referencia.');
      const reused = await this.referrals.existsBy({
        referralSheetDocumentId: input.referralSheetDocumentId,
        ...(currentId ? { id: Not(currentId) } : {}),
      });
      if (reused)
        throw new BadRequestException(
          'Ese documento ya está vinculado a otra derivación.',
        );
    }

    const specialty = input.specialty
      ? (await this.catalogValues.resolve('medical_specialty', input.specialty))
          .code
      : null;

    const issuedOn = input.issuedOn ?? null;
    const attendedOn = input.attendedOn ?? null;
    if (issuedOn && issuedOn < input.requestedOn)
      throw new BadRequestException('La fecha de emisión no puede ser anterior a la de solicitud.');
    if (attendedOn && attendedOn < input.requestedOn)
      throw new BadRequestException('La fecha de atención no puede ser anterior a la de solicitud.');
    if (input.status === ReferralStatus.ATTENDED && !attendedOn)
      throw new BadRequestException('Indica la fecha de atención.');

    return {
      originHealthCenterId: input.originHealthCenterId ?? null,
      destinationHealthCenterId: input.destinationHealthCenterId ?? null,
      specialty,
      type: input.type,
      status: input.status ?? ReferralStatus.REQUESTED,
      requestedOn: input.requestedOn,
      issuedOn,
      attendedOn,
      viaSepa: input.viaSepa ?? false,
      followUpId: input.followUpId ?? null,
      referralSheetDocumentId: input.referralSheetDocumentId ?? null,
      notes: input.notes?.trim() || null,
    };
  }
}
