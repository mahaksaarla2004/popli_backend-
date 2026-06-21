import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RechargeDto, WithdrawDto } from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async processViewEarnings() {
    this.logger.log('Starting Hourly View Earnings Processing...');

    // Fetch dynamic rates from SystemConfig (or fallback to defaults)
    const [rateConfig, tdsConfig, platformFeeConfig] = await Promise.all([
      this.prisma.systemConfig.findUnique({
        where: { key: 'VIEW_RATE_PER_1000' },
      }),
      this.prisma.systemConfig.findUnique({ where: { key: 'TDS_PERCENT' } }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'PLATFORM_FEE_PERCENT' },
      }),
    ]);

    const ratePer1000 =
      rateConfig && typeof rateConfig.valueJson === 'number'
        ? rateConfig.valueJson
        : 5.0;
    const tdsPercent =
      tdsConfig && typeof tdsConfig.valueJson === 'number'
        ? tdsConfig.valueJson
        : 10.0;
    const platformFeePercent =
      platformFeeConfig && typeof platformFeeConfig.valueJson === 'number'
        ? platformFeeConfig.valueJson
        : 2.0;

    // 1. Find all unprocessed ValidViews
    const unprocessedViews = await this.prisma.validView.findMany({
      where: { isProcessed: false },
      include: { reel: { select: { creatorId: true, isMonetized: true } } },
    });

    if (unprocessedViews.length === 0) {
      this.logger.log('No unprocessed views found.');
      return;
    }

    // 2. Create Earning Batch
    const batch = await this.prisma.earningBatch.create({
      data: {
        status: 'PROCESSING',
        totalViews: unprocessedViews.length,
        totalEarnings: 0, // Will update later
      },
    });

    // 3. Group views by Creator
    const creatorViewsMap = new Map<string, number>();
    for (const view of unprocessedViews) {
      if (view.reel.isMonetized) {
        const creatorId = view.reel.creatorId;
        creatorViewsMap.set(
          creatorId,
          (creatorViewsMap.get(creatorId) || 0) + 1,
        );
      }
    }

    let totalBatchEarnings = 0;

    // 4. Process payouts per creator inside transactions
    for (const [creatorId, viewCount] of creatorViewsMap.entries()) {
      // Require at least 100 views before processing payout to avoid spamming transactions
      if (viewCount < 100) {
        continue;
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          const grossEarnings = (viewCount * ratePer1000) / 1000;
          const tds = grossEarnings * (tdsPercent / 100);
          const platformFee = grossEarnings * (platformFeePercent / 100);
          const netEarnings = grossEarnings - tds - platformFee;

          if (netEarnings > 0) {
            totalBatchEarnings += netEarnings;

            // Upsert Wallet
            const wallet = await tx.wallet.upsert({
              where: { userId: creatorId },
              create: {
                userId: creatorId,
                withdrawableBalance: netEarnings,
                totalEarnings: netEarnings,
              },
              update: {
                withdrawableBalance: { increment: netEarnings },
                totalEarnings: { increment: netEarnings },
              },
            });

            // Create Ledger Entry
            await tx.walletLedger.create({
              data: {
                userId: creatorId,
                walletId: wallet.id,
                source: 'VIEW_EARNING',
                sourceId: batch.id,
                credit: netEarnings,
                balanceAfter: wallet.withdrawableBalance, // Prisma upsert returns the updated record.
                description: `Batch Earnings for ${viewCount} views. Gross: ₹${grossEarnings.toFixed(2)}, TDS: ₹${tds.toFixed(2)}, Fee: ₹${platformFee.toFixed(2)}`,
              },
            });

            // Mark these views as processed
            await tx.validView.updateMany({
              where: {
                isProcessed: false,
                reel: { creatorId: creatorId },
              },
              data: { isProcessed: true, batchId: batch.id },
            });

            // Notify User
            await tx.notification.create({
              data: {
                userId: creatorId,
                type: 'LIKE', // Fallback type for now, consider adding EARNING type
                title: 'Earnings Updated!',
                body: `You just earned ₹${netEarnings.toFixed(2)} from ${viewCount} valid views!`,
              },
            });
          }
        });
      } catch (error) {
        this.logger.error(
          `Failed to process earnings for creator ${creatorId}:`,
          error,
        );
      }
    }

    // 5. Complete Batch
    await this.prisma.earningBatch.update({
      where: { id: batch.id },
      data: {
        status: 'COMPLETED',
        totalEarnings: totalBatchEarnings,
        processedAt: new Date(),
      },
    });

    this.logger.log(
      `Hourly earnings calculation completed. Batch ID: ${batch.id}. Total Creators: ${creatorViewsMap.size}. Total Net Payout: ₹${totalBatchEarnings}`,
    );
  }

  async getBalance(userId: string) {
    // We return the wallet along with the immutable ledger history, not the old transactions
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        ledgers: { orderBy: { createdAt: 'desc' }, take: 50 },
        withdrawalRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    let targetWallet = wallet;

    if (!wallet) {
      targetWallet = await this.prisma.wallet.create({
        data: { userId },
        include: {
          ledgers: true,
          withdrawalRequests: true,
          transactions: true,
        },
      });
    }

    const ledgerAggregations = await this.prisma.walletLedger.groupBy({
      by: ['source'],
      where: { userId },
      _sum: { credit: true },
    });

    let viewEarnings = 0;
    let giftEarnings = 0;
    let referralEarnings = 0;

    for (const agg of ledgerAggregations) {
      if (agg.source === 'VIEW_EARNING') viewEarnings = agg._sum.credit || 0;
      if (agg.source === 'GIFT_RECEIVED') giftEarnings = agg._sum.credit || 0;
      if (agg.source === 'REFERRAL_BONUS') referralEarnings = agg._sum.credit || 0;
    }

    return {
      ...targetWallet,
      viewEarnings,
      giftEarnings,
      referralEarnings,
    };
  }

  async withdraw(userId: string, dto: WithdrawDto) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException('Wallet not found');

      const kyc = await tx.kYCRecord.findFirst({
        where: { userId, status: 'APPROVED' },
      });
      if (!kyc)
        throw new BadRequestException(
          'KYC must be completed and approved before withdrawal',
        );

      // Check double submit
      const pendingRequest = await tx.withdrawalRequest.findFirst({
        where: { walletId: wallet.id, status: 'PENDING' },
      });
      if (pendingRequest) {
        throw new BadRequestException(
          'You already have a pending withdrawal request.',
        );
      }

      // Check balance (withdrawal should be from withdrawableBalance)
      if (wallet.withdrawableBalance < dto.amount) {
        throw new BadRequestException('Insufficient withdrawable balance');
      }

      const minWithdrawConfig = await tx.systemConfig.findUnique({
        where: { key: 'MIN_WITHDRAWAL_INR' },
      });
      const minWithdrawal =
        minWithdrawConfig && typeof minWithdrawConfig.valueJson === 'number'
          ? minWithdrawConfig.valueJson
          : 500;

      if (dto.amount < minWithdrawal) {
        throw new BadRequestException(
          `Minimum withdrawal amount is ₹${minWithdrawal}`,
        );
      }

      // TDS and Platform Fee Calculations
      const tdsConfig = await tx.systemConfig.findUnique({
        where: { key: 'TDS_PERCENTAGE' },
      });
      const feeConfig = await tx.systemConfig.findUnique({
        where: { key: 'PLATFORM_FEE_PERCENTAGE' },
      });

      const tdsPercent =
        tdsConfig && typeof tdsConfig.valueJson === 'number'
          ? tdsConfig.valueJson
          : 10;
      const feePercent =
        feeConfig && typeof feeConfig.valueJson === 'number'
          ? feeConfig.valueJson
          : 2;

      const tdsDeducted = (dto.amount * tdsPercent) / 100;
      const platformFeeDeducted = (dto.amount * feePercent) / 100;
      const netPayable = dto.amount - tdsDeducted - platformFeeDeducted;

      // 1. Create Withdrawal Request
      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          walletId: wallet.id,
          amount: dto.amount,
          netPayable: netPayable,
          status: 'PENDING',
          transactionId: dto.upiId, // Reusing field for UPI
        },
      });

      // 2. Lock the funds safely preventing race conditions
      let updatedWallet;
      try {
        updatedWallet = await tx.wallet.update({
          where: { id: wallet.id, withdrawableBalance: { gte: dto.amount } },
          data: { withdrawableBalance: { decrement: dto.amount } },
        });
      } catch (e) {
        throw new BadRequestException(
          'Insufficient balance or concurrent transaction detected.',
        );
      }

      // 3. Create Ledger Entry
      await tx.walletLedger.create({
        data: {
          userId: userId,
          walletId: wallet.id,
          source: 'WITHDRAWAL',
          sourceId: withdrawal.id,
          debit: dto.amount,
          balanceAfter: updatedWallet.withdrawableBalance,
          description: `Withdrawal Request to UPI: ${dto.upiId}`,
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'WITHDRAWAL_REQUESTED',
          entityType: 'WithdrawalRequest',
          entityId: withdrawal.id,
          newValue: { amount: dto.amount, upi: dto.upiId },
        },
      });

      return withdrawal;
    });
  }

  async rechargeCoins(userId: string, dto: RechargeDto) {
    // Legacy support for coin recharge
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
}
