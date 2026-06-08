import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitKycDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dob: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  panNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  aadharNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  upiId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bankAccount?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ifscCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accountType?: string;
}
