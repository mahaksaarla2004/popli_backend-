import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('kyc/pending')
  @ApiOperation({ summary: 'Get all pending KYC applications' })
  getPendingKyc(@Req() req: any) {
    return this.adminService.getPendingKyc();
  }

  @Post('kyc/:id/approve')
  @ApiOperation({ summary: 'Approve a KYC application' })
  approveKyc(@Param('id') kycId: string, @Req() req: any) {
    return this.adminService.approveKyc(kycId, req.user.id);
  }

  @Post('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user account' })
  suspendUser(@Param('id') userId: string, @Req() req: any) {
    return this.adminService.suspendUser(userId, req.user.id);
  }

  @Post('reels/:id/delete')
  @ApiOperation({ summary: 'Delete a reported reel' })
  deleteReel(@Param('id') reelId: string, @Req() req: any) {
    return this.adminService.deleteReel(reelId, req.user.id);
  }
}
