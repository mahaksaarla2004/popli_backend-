import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InterestsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.interest.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        icon: true,
      },
    });
  }
}
