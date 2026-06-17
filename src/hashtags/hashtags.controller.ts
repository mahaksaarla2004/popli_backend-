import { Controller, Get, Param, Query } from '@nestjs/common';
import { HashtagsService } from './hashtags.service';

@Controller('hashtags')
export class HashtagsController {
  constructor(private readonly hashtagsService: HashtagsService) {}

  @Get('trending')
  async getTrending(@Query('limit') limit: string) {
    return this.hashtagsService.getTrending(limit ? parseInt(limit) : 10);
  }

  @Get('search')
  async search(@Query('q') query: string, @Query('limit') limit: string) {
    if (!query) return [];
    return this.hashtagsService.search(query, limit ? parseInt(limit) : 10);
  }

  @Get(':name/reels')
  async getReelsByHashtag(
    @Param('name') name: string,
    @Query('limit') limit: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.hashtagsService.getReelsByHashtag(name, limit ? parseInt(limit) : 20, cursor);
  }
}
