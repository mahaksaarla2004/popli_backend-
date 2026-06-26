import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  CheckUserDto,
  VerifyFirebaseTokenDto,
  ChangePhoneDto,
  GoogleLoginDto,
} from './dto/auth.dto';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

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
  async verifyFirebaseToken(
    @Body() dto: VerifyFirebaseTokenDto,
    @Req() req: any,
    @Res() res: any,
  ) {
    try {
      const ip = req.ip || '';
      const userAgent = req.headers['user-agent'] || '';
      const result = await this.authService.verifyFirebaseToken(
        dto,
        ip,
        userAgent,
      );
      return res.status(HttpStatus.OK).json(result);
    } catch (error: any) {
      console.error('VERIFY ERROR:', error);
      return res.status(error.status || 500).json({
        message: error.message,
        stack: error.stack,
        fullError: JSON.stringify(error),
      });
    }
  }

 @Post('google-login')
  @ApiOperation({ summary: 'Sign in with Google via Firebase ID Token' })
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() dto: GoogleLoginDto, @Req() req: any, @Res() res: any) {
    try {
      const ip = req.ip || '';
      const userAgent = req.headers['user-agent'] || '';
      const result = await this.authService.googleLogin(dto, ip, userAgent);
      return res.status(HttpStatus.OK).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Post('demo-login')
  @ApiOperation({ summary: 'Bypass Firebase for client demo' })
  @HttpCode(HttpStatus.OK)
  async demoLogin(
    @Body() dto: { phone: string; otp: string },
    @Req() req: any,
    @Res() res: any,
  ) {
    if (dto.otp !== '1234') {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: 'Invalid OTP' });
    }
    const ip = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';
    try {
      const result = await this.authService.demoLogin(dto.phone, ip, userAgent);
      return res.status(HttpStatus.OK).json(result);
    } catch (error: any) {
      console.error('DEMO LOGIN ERROR:', error);
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-phone')
  @ApiOperation({ summary: 'Change phone number after OTP verification of both old and new numbers' })
  @HttpCode(HttpStatus.OK)
  changePhone(@Body() dto: ChangePhoneDto, @Req() req: any) {
    return this.authService.changePhone(req.user.id, dto);
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

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @ApiOperation({ summary: 'Invalidate all sessions for the user' })
  @HttpCode(HttpStatus.OK)
  logoutAll(@Req() req: any) {
    return this.authService.logoutAll(req.user.sub);
  }
}
