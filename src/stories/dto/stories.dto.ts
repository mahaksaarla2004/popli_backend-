import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MediaType {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
}

export class CreateStoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mediaUrl: string;

  @ApiProperty({ enum: MediaType })
  @IsEnum(MediaType)
  mediaType: MediaType;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isCloseFriends?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  repliesAllowed?: boolean;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentionedUserIds?: string[];

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentionedUsernames?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalStoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalOwnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalOwnerUsername?: string;

  @ApiPropertyOptional()
  @IsOptional()
  layersData?: any;
}

export class ReactStoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  emoji: string;
}

export class CreateHighlightDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  coverUrl: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  storyIds: string[];
}
