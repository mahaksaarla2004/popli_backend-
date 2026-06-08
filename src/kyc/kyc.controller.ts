import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KycService } from './kyc.service';
import { SubmitKycDto } from './dto/kyc.dto';

@ApiTags('kyc')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current KYC status' })
  getKycStatus(@Req() req: any) {
    return this.kycService.getKycStatus(req.user.id);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit KYC details' })
  submitKyc(@Req() req: any, @Body() dto: SubmitKycDto) {
    return this.kycService.submitKyc(req.user.id, dto);
  }
}
