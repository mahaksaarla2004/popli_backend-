import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChallengesService } from './challenges.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get all active challenges' })
  getActiveChallenges() {
    return this.challengesService.getActiveChallenges();
  }

  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Get leaderboard for a challenge' })
  getLeaderboard(@Param('id') challengeId: string) {
    return this.challengesService.getLeaderboard(challengeId);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join an active challenge' })
  joinChallenge(@Param('id') challengeId: string, @Req() req: any) {
    return this.challengesService.joinChallenge(req.user.id, challengeId);
  }
}
