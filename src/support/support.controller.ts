import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/support.dto';

@ApiTags('support')
@Controller('support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'Get all user tickets' })
  getMyTickets(@Req() req: any) {
    return this.supportService.getMyTickets(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new support ticket' })
  createTicket(@Req() req: any, @Body() dto: CreateTicketDto) {
    return this.supportService.createTicket(req.user.id, dto);
  }
}
