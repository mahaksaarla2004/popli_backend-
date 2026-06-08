import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global multi-model search' })
  search(@Query('q') query: string) {
    if (!query) return { users: [], reels: [] };
    return this.searchService.searchAll(query);
  }
}
