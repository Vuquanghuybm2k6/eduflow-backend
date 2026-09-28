import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('statistics')
  getStatistics(
    @CurrentUser('userId') userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.dashboardService.getStatistics(userId, { organizationId });
  }
}
