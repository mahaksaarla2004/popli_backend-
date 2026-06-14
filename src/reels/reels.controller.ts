import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReelsService } from './reels.service';
import { CreateReelDto, AddCommentDto } from './dto/reels.dto';

@ApiTags('reels')
@Controller('reels')
export class ReelsController {
  constructor(private readonly reelsService: ReelsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new reel/post' })
  createReel(@Req() req: any, @Body() dto: CreateReelDto) {
    return this.reelsService.createReel(req.user.id, dto);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get global feed' })
  getFeed(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('category') category: string,
    @Query('excludeIds') excludeIds: string,
  ) {
    const excludeIdsArray = excludeIds ? excludeIds.split(',').filter(id => id.length > 0) : [];
    return this.reelsService.getFeed(
      Number(page) || 1,
      Number(limit) || 10,
      category,
      excludeIdsArray
    );
  }

  @Get('user/:id')
  @ApiOperation({ summary: 'Get reels posted by a specific user' })
  getUserReels(@Param('id') userId: string) {
    return this.reelsService.getUserReels(userId);
  }

  @Get('following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reels from followed users' })
  getFollowingFeed(
    @Req() req: any,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.reelsService.getFollowingFeed(
      req.user.id,
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle like on a reel' })
  toggleLike(@Param('id') reelId: string, @Req() req: any) {
    return this.reelsService.toggleLike(reelId, req.user.id);
  }

  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle save on a reel' })
  toggleSave(@Param('id') reelId: string, @Req() req: any) {
    return this.reelsService.toggleSave(reelId, req.user.id);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment to a reel' })
  addComment(
    @Param('id') reelId: string,
    @Req() req: any,
    @Body() dto: AddCommentDto,
  ) {
    return this.reelsService.addComment(reelId, req.user.id, dto);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for a reel' })
  getComments(@Param('id') reelId: string) {
    return this.reelsService.getComments(reelId);
  }

  @Post('comments/:commentId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle like on a comment' })
  toggleCommentLike(@Param('commentId') commentId: string, @Req() req: any) {
    return this.reelsService.toggleCommentLike(commentId, req.user.id);
  }

  @Get('liked')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user liked reels' })
  getLikedReels(@Req() req: any) {
    return this.reelsService.getLikedReels(req.user.id);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user watch history' })
  getWatchHistory(@Req() req: any) {
    return this.reelsService.getWatchHistory(req.user.id);
  }

  @Post(':id/view')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a view on a reel' })
  registerView(@Param('id') reelId: string, @Req() req: any) {
    // If the user is authenticated, log to watch history.
    return this.reelsService.incrementView(reelId, req.user?.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single reel by ID' })
  getReelById(@Param('id') reelId: string) {
    return this.reelsService.getReelById(reelId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a reel' })
  deleteReel(@Param('id') reelId: string, @Req() req: any) {
    console.log(`[DELETE REEL] User ${req.user?.id} is trying to delete reel ID: ${reelId}`);
    return this.reelsService.deleteReel(reelId, req.user.id);
  }
}
