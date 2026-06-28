import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendGiftDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  receiverId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  giftId: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  cost?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reelId?: string;
}
