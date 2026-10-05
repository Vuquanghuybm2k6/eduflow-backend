import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('statistics')
  getStatistics(@CurrentOrganization() organizationId: string) {
    return this.dashboardService.getStatistics(organizationId);
  }
}
