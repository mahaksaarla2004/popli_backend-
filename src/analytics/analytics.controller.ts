import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get creator analytics dashboard' })
  getDashboard(@Req() req: any) {
    return this.analyticsService.getCreatorDashboard(req.user.id);
  }

  @Post('track')
  @ApiOperation({ summary: 'Track user event' })
  trackEvent(@Req() req: any, @Body() body: { event: string, metadata?: any }) {
    return this.analyticsService.trackEvent(req.user.id, body.event, body.metadata);
  }
}
