import { DashboardIndicatorQueryDto } from '../../dashboard/dto/dashboard-indicator-query.dto';

/**
 * Same filters as the dashboard. Without a period, every enrolled patient is
 * exported; without a population, inactive patients are included.
 */
export class ExportPatientsQueryDto extends DashboardIndicatorQueryDto {}
