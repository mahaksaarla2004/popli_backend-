import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChallengesService } from './challenges.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  // --- Admin Routes ---
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all challenges for admin dashboard' })
  getAdminChallenges(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.challengesService.getAdminChallenges(
      page ? parseInt(page) : 1, 
      limit ? parseInt(limit) : 10,
      search,
      status
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new challenge (Admin only)' })
  createChallenge(@Body() data: any) {
    return this.challengesService.createChallenge(data);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a challenge (Admin only)' })
  updateChallenge(@Param('id') id: string, @Body() data: any) {
    return this.challengesService.updateChallenge(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a challenge (Admin only)' })
  deleteChallenge(@Param('id') id: string) {
    return this.challengesService.deleteChallenge(id);
  }

  @Get('admin/:id/participants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get challenge participants (Admin)' })
  getChallengeParticipants(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.challengesService.getChallengeParticipants(id, page ? parseInt(page) : 1, limit ? parseInt(limit) : 10);
  }

  @Get('admin/:id/reels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all challenge reels including pending (Admin)' })
  getAdminChallengeReels(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.challengesService.getAdminChallengeReels(id, page ? parseInt(page) : 1, limit ? parseInt(limit) : 10);
  }

  @Put('admin/reels/:reelId/approval')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve or Reject a reel' })
  approveReel(
    @Param('reelId') reelId: string,
    @Body('status') status: 'APPROVED' | 'REJECTED'
  ) {
    return this.challengesService.approveReel(reelId, status);
  }

  @Post('admin/:id/winners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Freeze leaderboard and select winners' })
  freezeLeaderboard(
    @Param('id') id: string,
    @Body('winnerUserIds') winnerUserIds: string[]
  ) {
    return this.challengesService.freezeLeaderboardAndSelectWinners(id, winnerUserIds);
  }

  @Post('admin/rewards/:txId/process')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process a pending reward transaction' })
  processRewardTransaction(@Param('txId') txId: string) {
    return this.challengesService.processRewardTransaction(txId);
  }

  @Get('admin/:id/rewards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get challenge reward transactions (Admin)' })
  getAdminChallengeRewards(@Param('id') id: string) {
    return this.challengesService.getAdminChallengeRewards(id);
  }

  @Get('admin/:id/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get challenge analytics (Admin)' })
  getChallengeAnalytics(@Param('id') id: string) {
    return this.challengesService.getChallengeAnalytics(id);
  }

  // --- Public / User Routes ---
  @Get()
  @ApiOperation({ summary: 'Get active challenges (paginated)' })
  getActiveChallenges(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.challengesService.getActiveChallenges(page ? parseInt(page) : 1, limit ? parseInt(limit) : 10);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get challenge details' })
  getChallenge(@Param('id') challengeId: string) {
    return this.challengesService.getChallenge(challengeId);
  }

  @Get(':id/reels')
  @ApiOperation({ summary: 'Get reels submitted to a challenge' })
  getChallengeReels(
    @Param('id') challengeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.challengesService.getChallengeReels(challengeId, page ? parseInt(page) : 1, limit ? parseInt(limit) : 10, sort || 'latest');
  }

  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Get leaderboard for a challenge' })
  getLeaderboard(
    @Param('id') challengeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.challengesService.getLeaderboard(challengeId, page ? parseInt(page) : 1, limit ? parseInt(limit) : 10);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join an active challenge' })
  joinChallenge(@Param('id') challengeId: string, @Req() req: any) {
    return this.challengesService.joinChallenge(req.user.id, challengeId);
  }
}
