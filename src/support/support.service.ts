import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/support.dto';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async createTicket(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        ...dto,
        creatorId: userId,
      },
    });
  }

  async getMyTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
