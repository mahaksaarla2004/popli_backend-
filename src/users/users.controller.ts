import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto, UpdatePreferencesDto } from './dto/users.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile' })
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Put('me/preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user preferences' })
  updatePreferences(@Req() req: any, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(req.user.id, dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by username or name' })
  searchUsers(@Query('q') query: string) {
    return this.usersService.searchUsers(query);
  }

  @Get('creators')
  @ApiOperation({ summary: 'Get list of creators' })
  getCreators() {
    return this.usersService.getCreators();
  }

  @Get('creator/:username')
  @ApiOperation({ summary: 'Get a public creator profile by username' })
  getCreatorProfile(@Param('username') username: string) {
    return this.usersService.getCreatorProfile(username);
  }
}
