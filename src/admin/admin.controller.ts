import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  Body,
  Delete,
} from '@nestjs/common';
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

  @Get('withdrawals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all withdrawal requests' })
  getWithdrawals(@Req() req: any) {
    return this.adminService.getWithdrawals(req.user.id);
  }

  @Post('withdrawals/:id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a withdrawal request' })
  approveWithdrawal(@Param('id') reqId: string, @Req() req: any) {
    return this.adminService.approveWithdrawal(reqId, req.user.id);
  }

  @Post('withdrawals/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a withdrawal request' })
  rejectWithdrawal(@Param('id') reqId: string, @Body('reason') reason: string, @Req() req: any) {
    return this.adminService.rejectWithdrawal(reqId, req.user.id, reason);
  }

  // Gifts
  @Get('gifts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all premium gifts' })
  getGifts() {
    return this.adminService.getGifts();
  }

  @Post('gifts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new premium gift' })
  addGift(@Body() body: any, @Req() req: any) {
    return this.adminService.addGift(body, req.user.id);
  }

  @Delete('gifts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a premium gift' })
  deleteGift(@Param('id') giftId: string, @Req() req: any) {
    return this.adminService.deleteGift(giftId, req.user.id);
  }

  // System Configs
  @Get('configs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all system configs' })
  getConfigs(@Req() req: any) {
    return this.adminService.getConfigs(req.user.id);
  }

  @Post('configs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a system config' })
  updateConfig(@Body() body: { key: string, value: any }, @Req() req: any) {
    return this.adminService.updateConfig(body.key, body.value, req.user.id);
  }
}
