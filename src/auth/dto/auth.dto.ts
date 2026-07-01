import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  identifier: string; // phone or email
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({ example: 'Mahek Saarla', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'mahek_saarla', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'device-12345', required: false })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ example: 'REF123', required: false })
  @IsOptional()
  @IsString()
  referredByCode?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class CheckUserDto {
  @ApiProperty({ example: '+919876543210', required: false })
  @IsOptional()
  @IsString()
  identifier?: string; // phone or email

  @ApiProperty({ example: 'popliuser', required: false })
  @IsOptional()
  @IsString()
  username?: string;
}

export class VerifyFirebaseTokenDto {
  @ApiProperty({ example: 'eyJh...' })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiProperty({ example: 'device-12345', required: false })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ example: 'REF123', required: false })
  @IsOptional()
  @IsString()
  referredByCode?: string;

  @ApiProperty({ example: 'login', required: false })
  @IsOptional()
  @IsString()
  intent?: 'login' | 'signup';

  @ApiProperty({ example: 'Mahek Saarla', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'mahek_saarla', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'mahek@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '10/05/2004', required: false })
  @IsOptional()
  @IsString()
  dob?: string;

  @ApiProperty({ example: '+919876543210', required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class ChangePhoneDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  oldPhone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  newPhone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  oldPhoneOtp: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  newPhoneOtp: string;
}

export class GoogleLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  referredByCode?: string;
}