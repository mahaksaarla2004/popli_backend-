import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RechargeDto, WithdrawDto } from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async calculateHourlyEarnings() {
    this.logger.log('Running hourly earnings calculation...');

    // 1. Get all reels with pending earnings views
    const reels = await this.prisma.reel.findMany({
      where: { pendingEarningsViews: { gt: 0 } },
      select: { id: true, creatorId: true, pendingEarningsViews: true },
    });

    if (reels.length === 0) {
      this.logger.log('No pending views to process.');
      return;
    }

    // 2. Process each reel
    for (const reel of reels) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Gross = Views * 5 / 1000
          const grossEarnings = (reel.pendingEarningsViews * 5) / 1000;

          // Deductions: 10% TDS
          const tds = grossEarnings * 0.10;
          const netEarnings = grossEarnings - tds;

          if (netEarnings > 0) {
            // Note: We DO NOT increment the wallet balance here anymore!
            // It is already incremented in real-time inside `incrementView` (reels.service.ts).
            // We only create the transaction record here for the ledger.

            // Log transaction (Optional, but good for ledger)
            const wallet = await tx.wallet.findUnique({
              where: { userId: reel.creatorId },
            });
            if (wallet) {
              await tx.transaction.create({
                data: {
                  walletId: wallet.id,
                  type: 'AD_REVENUE',
                  amount: netEarnings,
                  currency: 'INR',
                  status: 'SUCCESS',
                  description: `Earnings for ${reel.pendingEarningsViews} views (TDS: ₹${tds.toFixed(2)})`,
                },
              });
            }
          }

          // Reset pending views
          await tx.reel.update({
            where: { id: reel.id },
            data: { pendingEarningsViews: 0 },
          });
        });
      } catch (error) {
        this.logger.error(
          `Failed to process earnings for reel ${reel.id}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Hourly earnings calculation completed for ${reels.length} reels.`,
    );
  }

  async getBalance(userId: string) {
    return this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
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
        },
      });

      return tx.wallet.update({
        where: { id: wallet.id },
        data: { coinBalance: { increment: dto.amount } },
      });
    });
  }

  async withdraw(userId: string, dto: WithdrawDto) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException('Wallet not found');

      // Strict KYC Check
      // const kyc = await tx.kYCRecord.findUnique({ where: { userId } });
      // if (!kyc || kyc.status !== 'APPROVED') {
      //   throw new BadRequestException('Please complete your KYC to withdraw funds.');
      // }

      // if (dto.amount < 500) {
      //   throw new BadRequestException('Minimum withdrawal amount is ₹500');
      // }

      // if (wallet.inrEarnings < dto.amount) {
      //   throw new BadRequestException('Insufficient INR earnings');
      // }

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount: dto.amount,
          currency: 'INR',
          status: 'PENDING',
          referenceId: dto.upiId,
        },
      });

      return tx.wallet.update({
        where: { id: wallet.id },
        data: { inrEarnings: { decrement: dto.amount } },
      });
    });
  }
}
