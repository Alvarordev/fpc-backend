import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CatalogItem } from '../../../database/entities/catalog-item.entity';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { HealthCenter } from '../../../database/entities/health-center.entity';
import { PatientDetails } from '../../../database/entities/patient-details.entity';
import { PatientInsurance } from '../../../database/entities/patient-insurance.entity';
import {
  PatientSocialReferral,
  SocialReferralStatus,
  SocialReferralType,
} from '../../../database/entities/patient-social-referral.entity';
import { PatientSocialReferralUpdate } from '../../../database/entities/patient-social-referral-update.entity';
import { CatalogValueService } from '../../catalogs/catalog-value.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { PatientsService } from '../patients.service';
import { PatientSocialReferralsService } from './patient-social-referrals.service';

describe('PatientSocialReferralsService', () => {
  const repos = new Map<unknown, Record<string, jest.Mock>>();
  const repo = (entity: unknown) => {
    if (!repos.has(entity))
      repos.set(entity, {
        create: jest.fn((value: unknown) => value),
        save: jest.fn((value: object) =>
          Promise.resolve({ id: 'saved-id', ...value }),
        ),
        findOneBy: jest.fn(),
        existsBy: jest.fn().mockResolvedValue(true),
        update: jest.fn(),
      });
    return repos.get(entity)!;
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) => repo(entity)),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn(
      async (work: (manager: EntityManager) => Promise<unknown>) =>
        work(manager),
    ),
  } as unknown as DataSource;
  const repository = {
    findOneOrFail: jest.fn(),
  } as unknown as Repository<PatientSocialReferral>;
  const patients = {
    assertPatientRole: jest.fn(),
  } as unknown as PatientsService;
  const catalogValues = {
    resolve: jest.fn(),
  } as unknown as CatalogValueService;
  const invalidations = {
    markDirty: jest.fn(),
  } as unknown as PatientSummaryInvalidationService;
  let service: PatientSocialReferralsService;

  beforeEach(() => {
    repos.clear();
    jest.clearAllMocks();
    (repository.findOneOrFail as jest.Mock).mockResolvedValue({});
    service = new PatientSocialReferralsService(
      repository,
      dataSource,
      patients,
      catalogValues,
      invalidations,
    );
  });

  it('rejects FISSAL for patients without SIS', async () => {
    repo(PatientInsurance).findOneBy.mockResolvedValue({
      insuranceType: 'ESSALUD',
    });

    await expect(
      service.create(
        'patient-id',
        { followUpId: 'follow-up-id', type: SocialReferralType.FISSAL },
        'author-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects CONADIS when the patient already has the card', async () => {
    repo(PatientDetails).findOneBy.mockResolvedValue({ hasConadisCard: true });

    await expect(
      service.create(
        'patient-id',
        { followUpId: 'follow-up-id', type: SocialReferralType.CONADIS },
        'author-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a complaint channel outside the patient insurance', async () => {
    repo(PatientInsurance).findOneBy.mockResolvedValue({
      insuranceType: 'SIS',
    });
    (catalogValues.resolve as jest.Mock).mockResolvedValue({
      code: 'DEFENSORIA_ESSALUD',
      label: 'Defensoría del Asegurado (EsSalud)',
      other: null,
    });
    repo(CatalogItem).findOneBy.mockResolvedValue({
      metadata: { insuranceTypes: ['ESSALUD'] },
    });

    await expect(
      service.create(
        'patient-id',
        {
          followUpId: 'follow-up-id',
          type: SocialReferralType.COMPLAINT,
          complaintChannel: 'DEFENSORIA_ESSALUD',
          healthCenterId: 'center-id',
          issue: 'Tomógrafo malogrado',
        },
        'author-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('opens a complaint tied to a health center', async () => {
    (catalogValues.resolve as jest.Mock).mockResolvedValue({
      code: 'SUSALUD',
      label: 'SUSALUD',
      other: null,
    });
    repo(CatalogItem).findOneBy.mockResolvedValue({ metadata: null });

    await service.create(
      'patient-id',
      {
        followUpId: 'follow-up-id',
        type: SocialReferralType.COMPLAINT,
        complaintChannel: 'SUSALUD',
        healthCenterId: 'center-id',
        issue: ' Mamógrafo malogrado ',
        openedAt: '2026-10-01',
      },
      'author-id',
    );

    expect(repo(HealthCenter).existsBy).toHaveBeenCalledWith({
      id: 'center-id',
    });
    expect(repo(FollowUp).existsBy).toHaveBeenCalledWith({
      id: 'follow-up-id',
      subjectPatientId: 'patient-id',
    });
    expect(repo(PatientSocialReferral).save).toHaveBeenCalledWith(
      expect.objectContaining({
        complaintChannel: 'SUSALUD',
        healthCenterId: 'center-id',
        issue: 'Mamógrafo malogrado',
        status: SocialReferralStatus.OPEN,
        openedAt: '2026-10-01',
        createdById: 'author-id',
      }),
    );
  });

  it('closes the referral on a final outcome and records the card', async () => {
    const referral = {
      id: 'referral-id',
      type: SocialReferralType.CONADIS,
      status: SocialReferralStatus.OPEN,
      closedAt: null,
    };
    repo(PatientSocialReferral).findOneBy.mockResolvedValue(referral);
    (catalogValues.resolve as jest.Mock).mockResolvedValue({
      code: 'OBTAINED',
      label: 'Adquirió el carnet',
      other: null,
    });
    repo(CatalogItem).findOneBy.mockResolvedValue({ metadata: null });

    await service.addUpdate(
      'patient-id',
      'referral-id',
      { followUpId: 'follow-up-id', outcome: 'OBTAINED' },
      'author-id',
    );

    expect(repo(PatientSocialReferralUpdate).save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'OBTAINED', authorId: 'author-id' }),
    );
    expect(referral.status).toBe(SocialReferralStatus.CLOSED);
    expect(referral.closedAt).not.toBeNull();
    expect(repo(PatientDetails).update).toHaveBeenCalledWith(
      { patientId: 'patient-id' },
      { hasConadisCard: true },
    );
  });

  it('keeps the referral open when there is no information yet', async () => {
    const referral = {
      id: 'referral-id',
      type: SocialReferralType.SOCIAL_WORKER,
      status: SocialReferralStatus.CLOSED,
      closedAt: '2026-09-01',
    };
    repo(PatientSocialReferral).findOneBy.mockResolvedValue(referral);
    (catalogValues.resolve as jest.Mock).mockResolvedValue({
      code: 'NO_INFO',
      label: 'No hay información',
      other: null,
    });
    repo(CatalogItem).findOneBy.mockResolvedValue({
      metadata: { closesReferral: false },
    });

    await service.addUpdate(
      'patient-id',
      'referral-id',
      { followUpId: 'follow-up-id', outcome: 'NO_INFO' },
      'author-id',
    );

    expect(referral.status).toBe(SocialReferralStatus.OPEN);
    expect(referral.closedAt).toBeNull();
    expect(repo(PatientDetails).update).not.toHaveBeenCalled();
  });
});
