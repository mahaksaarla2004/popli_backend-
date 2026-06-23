import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoriesService } from './stories.service';
import {
  CreateStoryDto,
  ReactStoryDto,
  CreateHighlightDto,
} from './dto/stories.dto';

@ApiTags('stories')
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new story' })
  createStory(@Req() req: any, @Body() dto: CreateStoryDto) {
    return this.storiesService.createStory(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active stories for feed' })
  getActiveStories(@Req() req: any) {
    return this.storiesService.getActiveStories(req.user.id);
  }

  @Get('story/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific story by ID' })
  getStoryById(@Param('id') storyId: string, @Req() req: any) {
    return this.storiesService.getStoryById(storyId, req.user.id);
  }

  @Post(':id/view')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark story as viewed' })
  markViewed(@Param('id') storyId: string, @Req() req: any) {
    return this.storiesService.markViewed(storyId, req.user.id);
  }

  @Post(':id/react')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'React to a story' })
  reactToStory(
    @Param('id') storyId: string,
    @Req() req: any,
    @Body() dto: ReactStoryDto,
  ) {
    return this.storiesService.reactToStory(storyId, req.user.id, dto);
  }

  @Post(':id/interact')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Interact with a story sticker (Poll, Question, etc)',
  })
  interactWithStory(
    @Param('id') storyId: string,
    @Req() req: any,
    @Body() dto: any,
  ) {
    return this.storiesService.interactWithStory(storyId, req.user.id, dto);
  }

  @Get(':id/interactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get story interactions' })
  getStoryInteractions(@Param('id') storyId: string) {
    return this.storiesService.getStoryInteractions(storyId);
  }

  @Get(':id/viewers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get story viewers (Creator only)' })
  getStoryViewers(@Param('id') storyId: string, @Req() req: any) {
    return this.storiesService.getStoryViewers(storyId, req.user.id);
  }

  @Get('archive')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get archived stories' })
  getArchivedStories(@Req() req: any) {
    return this.storiesService.getArchivedStories(req.user.id);
  }

  @Post('highlights')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new story highlight' })
  createHighlight(@Req() req: any, @Body() dto: CreateHighlightDto) {
    return this.storiesService.createHighlight(req.user.id, dto);
  }

  @Get('highlights/:creatorId')
  @ApiOperation({ summary: 'Get creator highlights' })
  getHighlights(@Param('creatorId') creatorId: string) {
    return this.storiesService.getHighlights(creatorId);
  }

  @Get('highlights/view/:id')
  @ApiOperation({ summary: 'Get stories inside a highlight' })
  getHighlightStories(@Param('id') id: string) {
    return this.storiesService.getHighlightStories(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a story' })
  deleteStory(@Param('id') storyId: string, @Req() req: any) {
    return this.storiesService.deleteStory(storyId, req.user.id);
  }

  @Delete('highlights/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a highlight' })
  deleteHighlight(@Param('id') highlightId: string, @Req() req: any) {
    return this.storiesService.deleteHighlight(highlightId, req.user.id);
  }
}
