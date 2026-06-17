import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('configs')
  @ApiOperation({ summary: 'Get public system configurations' })
  async getConfigs(@Query('keys') keys?: string) {
    let whereClause = {};
    if (keys) {
      const keyArray = keys.split(',');
      whereClause = { key: { in: keyArray } };
    }

    const configs = await this.prisma.systemConfig.findMany({
      where: whereClause,
      select: { key: true, valueJson: true }
    });

    // Format as key-value pairs
    const result: Record<string, any> = {};
    configs.forEach(config => {
      result[config.key] = config.valueJson;
    });

    return result;
  }
}
