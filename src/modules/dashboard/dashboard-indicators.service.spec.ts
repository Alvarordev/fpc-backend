import { DataSource } from 'typeorm';
import { DashboardIndicatorsService } from './dashboard-indicators.service';
import { DashboardPeriod } from './dto/dashboard-query.dto';
import { DashboardPopulation } from './dto/dashboard-indicator-query.dto';

describe('DashboardIndicatorsService', () => {
  it('builds demographic coverage from distinct population counts', async () => {
    const query = jest.fn();
    query.mockResolvedValueOnce([{ count: '2' }]).mockResolvedValueOnce([
      {
        category: 'gender',
        label: 'FEMALE',
        count: '1',
        known: '1',
        unknown: '1',
      },
      {
        category: 'gender',
        label: 'Sin informacion',
        count: '1',
        known: '1',
        unknown: '1',
      },
    ]);
    const service = new DashboardIndicatorsService({
      query,
    } as unknown as DataSource);

    const result = await service.getDemographics({
      from: '2026-01-01',
      to: '2026-02-01',
    });

    expect(result.meta).toMatchObject({
      from: '2026-01-01',
      to: '2026-02-01',
      timezone: 'America/Lima',
      populationCount: 2,
      enrolledBeforePeriod: 0,
    });
    expect(query.mock.calls[0][0]).toContain(
      "patient.activity_status IN ('ACTIVE', 'REACTIVE')",
    );
    expect(query.mock.calls[0][0]).toContain('$1::timestamptz');
    expect(query.mock.calls[0][0]).toContain('$2::timestamptz');
    expect(result.gender).toEqual({
      items: [
        { label: 'FEMALE', count: 1 },
        { label: 'Sin informacion', count: 1 },
      ],
      known: 1,
      unknown: 1,
      population: 2,
      coveragePct: 50,
    });
    expect(query).toHaveBeenNthCalledWith(1, expect.any(String), [
      '2026-01-01T05:00:00.000Z',
      '2026-02-01T05:00:00.000Z',
    ]);
  });

  it('resolves a Lima calendar month to an exclusive UTC boundary', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);
    const service = new DashboardIndicatorsService({
      query,
    } as unknown as DataSource);

    const result = await service.getDemographics({
      period: DashboardPeriod.MONTH,
      year: 2026,
      month: 2,
    });

    expect(result.meta).toMatchObject({ from: '2026-02-01', to: '2026-03-01' });
    expect(query).toHaveBeenNthCalledWith(2, expect.any(String), [
      '2026-02-01T05:00:00.000Z',
      '2026-03-01T05:00:00.000Z',
      '2026-03-01',
    ]);
  });

  it('maps distinct epidemiology events and current distributions', async () => {
    const query = jest.fn();
    query
      .mockResolvedValueOnce([{ count: '3' }])
      .mockResolvedValueOnce([
        {
          category: 'currentDiagnosticStatuses',
          label: 'SEARCHING',
          count: '2',
          known: '2',
          unknown: '1',
        },
        {
          category: 'currentDiagnosticStatuses',
          label: 'Sin informacion',
          count: '1',
          known: '2',
          unknown: '1',
        },
      ])
      .mockResolvedValueOnce([
        { category: 'deaths', count: '1' },
        { category: 'diagnosticConfirmed', count: '2' },
        { category: 'diagnosticRuledOut', count: '1' },
      ]);
    const service = new DashboardIndicatorsService({
      query,
    } as unknown as DataSource);

    const result = await service.getEpidemiology({
      from: '2026-01-01',
      to: '2027-01-01',
    });

    expect(result.currentDiagnosticStatuses).toMatchObject({
      known: 2,
      unknown: 1,
      population: 3,
      coveragePct: 66.67,
    });
    expect(result.events).toEqual({
      deaths: 1,
      diagnosticConfirmed: 2,
      diagnosticRuledOut: 1,
    });
  });

  it('passes only the parameters used by the productivity query', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([]);
    const service = new DashboardIndicatorsService({
      query,
    } as unknown as DataSource);

    await service.getProductivity({
      from: '2026-01-01',
      to: '2027-01-01',
    });

    expect(query).toHaveBeenNthCalledWith(2, expect.any(String), [
      '2026-01-01T05:00:00.000Z',
      '2027-01-01T05:00:00.000Z',
    ]);
    expect(query.mock.calls[1][0]).toContain("insurance.insurance_type = 'SIS'");
    expect(query.mock.calls[1][0]).toContain('IS DISTINCT FROM');
    expect(query.mock.calls[1][0]).not.toContain(
      'sis.affiliated_via_sepa = true',
    );
  });

  it('passes only the parameters used by the management metrics query', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = new DashboardIndicatorsService({
      query,
    } as unknown as DataSource);

    await service.getManagement({
      from: '2026-01-01',
      to: '2027-01-01',
    });

    expect(query).toHaveBeenNthCalledWith(2, expect.any(String), [
      '2026-01-01T05:00:00.000Z',
      '2027-01-01T05:00:00.000Z',
    ]);
    expect(query.mock.calls[1][0]).toContain(
      'symptom.attended_primary_care_via_sepa = true',
    );
    expect(query.mock.calls[1][0]).toContain(
      'symptom.referred_via_sepa = true',
    );
  });

  it('casts the adherence percentage before PostgreSQL rounds it', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([]);
    const service = new DashboardIndicatorsService({
      query,
    } as unknown as DataSource);

    await service.getAdherence({
      from: '2026-01-01',
      to: '2027-01-01',
    });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(')::numeric'),
      ['2026-01-01T05:00:00.000Z', '2027-01-01T05:00:00.000Z'],
    );
  });

  it('rejects incomplete or mixed indicator periods', async () => {
    const service = new DashboardIndicatorsService({
      query: jest.fn(),
    } as unknown as DataSource);

    await expect(
      service.getDemographics({ from: '2026-01-01' }),
    ).rejects.toThrow('from and to must be provided together');
    await expect(
      service.getDemographics({
        from: '2026-01-01',
        to: '2026-02-01',
        period: DashboardPeriod.MONTH,
        year: 2026,
        month: 1,
      }),
    ).rejects.toThrow('Use either from/to or period/year/month');
  });

  it('scopes the cohort to enrollments in the selected period', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: '4', enrolledBeforePeriod: '0' }])
      .mockResolvedValueOnce([]);
    const service = new DashboardIndicatorsService({
      query,
    } as unknown as DataSource);

    const result = await service.getDemographics({
      from: '2026-01-01',
      to: '2026-02-01',
      population: DashboardPopulation.ENROLLED_IN_PERIOD,
    });

    expect(query.mock.calls[0][0]).toContain(
      'first_enrollment.enrolled_at >= $1',
    );
    expect(query.mock.calls[0][0]).not.toContain('follow_ups');
    expect(result.meta.enrolledBeforePeriod).toBe(0);
    expect(result.meta.population).toContain('enrolamiento efectivo');
  });

  it('requires registered activity in the period for active_in_period', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: '3', enrolledBeforePeriod: '2' }])
      .mockResolvedValueOnce([]);
    const service = new DashboardIndicatorsService({
      query,
    } as unknown as DataSource);

    await service.getDemographics({
      from: '2026-01-01',
      to: '2026-02-01',
      population: DashboardPopulation.ACTIVE_IN_PERIOD,
    });

    expect(query.mock.calls[0][0]).toContain('follow_ups');
    expect(query.mock.calls[0][0]).toContain('psychooncology_appointments');
  });

  it('adds a sanitized department residence filter', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: '1', enrolledBeforePeriod: '0' }])
      .mockResolvedValueOnce([]);
    const service = new DashboardIndicatorsService({
      query,
    } as unknown as DataSource);

    await service.getDemographics({
      from: '2026-01-01',
      to: '2026-02-01',
      department: 'lima',
    });

    expect(query.mock.calls[0][0]).toContain("= 'LIMA'");
    expect(query.mock.calls[1][0]).toContain("= 'LIMA'");
  });

  it('ignores an invalid department token instead of interpolating it', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ count: '1' }])
      .mockResolvedValueOnce([]);
    const service = new DashboardIndicatorsService({
      query,
    } as unknown as DataSource);

    await service.getDemographics({
      from: '2026-01-01',
      to: '2026-02-01',
      department: "LIMA'; DROP TABLE patients; --",
    });

    expect(query.mock.calls[0][0]).not.toContain('DROP TABLE');
    expect(query.mock.calls[0][0]).not.toContain("= 'LIMA'");
  });
});
