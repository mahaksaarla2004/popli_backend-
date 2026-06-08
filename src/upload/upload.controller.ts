import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadService } from './upload.service';

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('signature')
  @ApiOperation({ summary: 'Get Cloudinary signed URL for direct upload' })
  getSignature(@Query('folder') folder: string = 'general') {
    return this.uploadService.getSignedUrl(folder);
  }
}
