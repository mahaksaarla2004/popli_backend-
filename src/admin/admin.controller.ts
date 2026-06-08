import { Controller, Get, Post, Param, UseGuards, Req, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Admin Login' })
  login(@Body() body: any) {
    return this.adminService.login(body.email, body.password);
  }

  @Get('dashboard-stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Dashboard Statistics' })
  getDashboardStats(@Req() req: any) {
    return this.adminService.getDashboardStats(req.user.id);
  }

  @Get('kyc/pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all pending KYC applications' })
  getPendingKyc(@Req() req: any) {
    return this.adminService.getPendingKyc();
  }

  @Post('kyc/:id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a KYC application' })
  approveKyc(@Param('id') kycId: string, @Req() req: any) {
    return this.adminService.approveKyc(kycId, req.user.id);
  }

  @Post('users/:id/suspend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suspend a user account' })
  suspendUser(@Param('id') userId: string, @Req() req: any) {
    return this.adminService.suspendUser(userId, req.user.id);
  }

  @Post('reels/:id/delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a reported reel' })
  deleteReel(@Param('id') reelId: string, @Req() req: any) {
    return this.adminService.deleteReel(reelId, req.user.id);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users' })
  getUsers(@Req() req: any) {
    return this.adminService.getUsers(req.user.id);
  }

  @Get('reels')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reels' })
  getReels(@Req() req: any) {
    return this.adminService.getReels(req.user.id);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all transactions' })
  getTransactions(@Req() req: any) {
    return this.adminService.getTransactions(req.user.id);
  }

  @Get('reports')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all moderation reports' })
  getReports(@Req() req: any) {
    return this.adminService.getReports(req.user.id);
  }

  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all support tickets' })
  getTickets(@Req() req: any) {
    return this.adminService.getTickets(req.user.id);
  }
}
