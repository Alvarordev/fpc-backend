import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Enrollment } from '../../database/entities/enrollment.entity';
import { FollowUpPurpose } from '../../database/entities/follow-up.enums';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { deleteHistoricalOwnedByFollowUp } from './historical-clinical.util';
import { HistoricalRecordsService } from './historical-records.service';

jest.mock('./historical-clinical.util', () => ({
  attachHistoricalClinicalData: jest.fn(),
  upsertHistoricalClinicalData: jest.fn(),
  deleteHistoricalOwnedByFollowUp: jest.fn(),
}));

describe('HistoricalRecordsService.deleteFollowUp', () => {
  const followUpId = 'follow-up-1';
  const patientId = 'patient-1';
  let service: HistoricalRecordsService;
  let findOne: jest.Mock;
  let deleteHistorical: jest.Mock;
  let existsBy: jest.Mock;
  let markDirty: jest.Mock;
  let getRepository: jest.Mock;
  let manager: EntityManager;

  beforeEach(() => {
    findOne = jest.fn();
    deleteHistorical = jest.fn();
    existsBy = jest.fn().mockResolvedValue(false);
    markDirty = jest.fn();
    getRepository = jest.fn(() => ({ existsBy }));
    manager = {
      getRepository,
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((work: (entityManager: EntityManager) => unknown) =>
        work(manager),
      ),
    } as unknown as DataSource;
    const followUps = {
      findOne,
      deleteHistorical,
    } as unknown as FollowUpsService;

    service = new HistoricalRecordsService(
      dataSource,
      {} as never,
      followUps,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {},
    );

    (deleteHistoricalOwnedByFollowUp as jest.Mock).mockClear();
    (deleteHistoricalOwnedByFollowUp as jest.Mock).mockResolvedValue(undefined);
    deleteHistorical.mockImplementation(() => {
      markDirty();
      return Promise.resolve();
    });
  });

  it('deletes a historical follow-up and marks the patient summary dirty', async () => {
    findOne.mockResolvedValue({
      id: followUpId,
      subjectPatientId: patientId,
      isHistorical: true,
      purpose: FollowUpPurpose.FOLLOW_UP,
    });

    await service.deleteFollowUp(followUpId);

    expect(deleteHistoricalOwnedByFollowUp).toHaveBeenCalledWith(
      manager,
      followUpId,
    );
    expect(deleteHistorical).toHaveBeenCalledWith(followUpId, manager);
    expect(markDirty).toHaveBeenCalled();
  });

  it('rejects operational follow-ups', async () => {
    findOne.mockResolvedValue({
      id: followUpId,
      subjectPatientId: patientId,
      isHistorical: false,
      purpose: FollowUpPurpose.FOLLOW_UP,
    });

    await expect(service.deleteFollowUp(followUpId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(deleteHistoricalOwnedByFollowUp).not.toHaveBeenCalled();
    expect(deleteHistorical).not.toHaveBeenCalled();
  });

  it('rejects enrollment follow-ups', async () => {
    findOne.mockResolvedValue({
      id: followUpId,
      subjectPatientId: patientId,
      isHistorical: true,
      purpose: FollowUpPurpose.ENROLLMENT,
    });

    await expect(service.deleteFollowUp(followUpId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(deleteHistoricalOwnedByFollowUp).not.toHaveBeenCalled();
  });

  it('rejects follow-ups linked to an enrollment row', async () => {
    findOne.mockResolvedValue({
      id: followUpId,
      subjectPatientId: patientId,
      isHistorical: true,
      purpose: FollowUpPurpose.FOLLOW_UP,
    });
    existsBy.mockResolvedValue(true);

    await expect(service.deleteFollowUp(followUpId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(getRepository).toHaveBeenCalledWith(Enrollment);
    expect(deleteHistoricalOwnedByFollowUp).not.toHaveBeenCalled();
  });
});
