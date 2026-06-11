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
}
