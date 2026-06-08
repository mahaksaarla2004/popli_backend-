import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RechargeDto, WithdrawDto } from './dto/wallet.dto';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    return this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 }
      }
    });
  }

  async rechargeCoins(userId: string, dto: RechargeDto) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException('Wallet not found');

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'COIN_RECHARGE',
          amount: dto.amount,
          currency: 'COINS',
          status: 'SUCCESS',
          referenceId: dto.paymentReference,
        }
      });

      return tx.wallet.update({
        where: { id: wallet.id },
        data: { coinBalance: { increment: dto.amount } }
      });
    });
  }

  async withdraw(userId: string, dto: WithdrawDto) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException('Wallet not found');

      if (wallet.inrEarnings < dto.amount) {
        throw new BadRequestException('Insufficient INR earnings');
      }

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount: dto.amount,
          currency: 'INR',
          status: 'PENDING',
          referenceId: dto.upiId,
        }
      });

      return tx.wallet.update({
        where: { id: wallet.id },
        data: { inrEarnings: { decrement: dto.amount } }
      });
    });
  }
}
