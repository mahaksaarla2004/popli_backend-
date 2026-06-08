import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { RechargeDto, WithdrawDto } from './dto/wallet.dto';

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get wallet balance and transactions' })
  getBalance(@Req() req: any) {
    return this.walletService.getBalance(req.user.id);
  }

  @Post('recharge')
  @ApiOperation({ summary: 'Recharge coins' })
  recharge(@Req() req: any, @Body() dto: RechargeDto) {
    return this.walletService.rechargeCoins(req.user.id, dto);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Request withdrawal to UPI' })
  withdraw(@Req() req: any, @Body() dto: WithdrawDto) {
    return this.walletService.withdraw(req.user.id, dto);
  }
}
