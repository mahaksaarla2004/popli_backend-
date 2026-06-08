import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GiftsService } from './gifts.service';
import { SendGiftDto } from './dto/gifts.dto';

@ApiTags('gifts')
@Controller('gifts')
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Get()
  @ApiOperation({ summary: 'Get available gifts list' })
  getGifts() {
    return this.giftsService.getGifts();
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a gift to a creator' })
  sendGift(@Req() req: any, @Body() dto: SendGiftDto) {
    return this.giftsService.sendGift(req.user.id, dto);
  }
}
