import { Controller, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, RefreshTokenDto, CheckUserDto, VerifyFirebaseTokenDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP to phone or email' })
  @HttpCode(HttpStatus.OK)
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and get JWT tokens' })
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: any) {
    const ip = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.verifyOtp(dto, ip, userAgent);
  }

  @Post('verify-firebase-token')
  @ApiOperation({ summary: 'Verify Firebase ID Token and get JWT' })
  @HttpCode(HttpStatus.OK)
  verifyFirebaseToken(@Body() dto: VerifyFirebaseTokenDto, @Req() req: any) {
    const ip = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.verifyFirebaseToken(dto, ip, userAgent);
  }

  @Post('check-user')
  @ApiOperation({ summary: 'Check if user exists and if profile is complete' })
  @HttpCode(HttpStatus.OK)
  checkUser(@Body() dto: CheckUserDto) {
    return this.authService.checkUser(dto);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Get new access token using refresh token' })
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Invalidate refresh token session' })
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
