import { Controller, Post, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SocialService } from './social.service';

@ApiTags('social')
@Controller('social')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post('follow/:id')
  @ApiOperation({ summary: 'Toggle follow user' })
  toggleFollow(@Param('id') followingId: string, @Req() req: any) {
    console.log(`[ToggleFollow] User ${req.user.id} attempting to follow/unfollow ${followingId}`);
    return this.socialService.toggleFollow(req.user.id, followingId);
  }

  @Get(':id/followers')
  @ApiOperation({ summary: 'Get followers' })
  getFollowers(@Param('id') userId: string) {
    return this.socialService.getFollowers(userId);
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'Get following' })
  getFollowing(@Param('id') userId: string) {
    return this.socialService.getFollowing(userId);
  }

  @Post('block/:id')
  @ApiOperation({ summary: 'Toggle block user' })
  toggleBlock(@Param('id') blockedId: string, @Req() req: any) {
    return this.socialService.toggleBlock(req.user.id, blockedId);
  }

  @Get('blocked')
  @ApiOperation({ summary: 'Get blocked users' })
  getBlockedUsers(@Req() req: any) {
    return this.socialService.getBlockedUsers(req.user.id);
  }
}
