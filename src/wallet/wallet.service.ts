import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RechargeDto, WithdrawDto } from './dto/wallet.dto';
import { Prisma } from '@prisma/client';

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

// 3. Group views by Creator AND Reel
    const reelViewsMap = new Map<string, { creatorId: string; viewCount: number }>();
    for (const view of unprocessedViews) {
      if (view.reel.isMonetized) {
        const key = view.reelId;
        const existing = reelViewsMap.get(key);
        if (existing) {
          existing.viewCount += 1;
        } else {
          reelViewsMap.set(key, { creatorId: view.reel.creatorId, viewCount: 1 });
        }
      }
    }

    // Group total views per creator for single wallet update + notification
    const creatorTotals = new Map<string, { totalViews: number; totalNet: number }>();
    for (const [, { creatorId, viewCount }] of reelViewsMap.entries()) {
      const existing = creatorTotals.get(creatorId);
      if (existing) {
        existing.totalViews += viewCount;
      } else {
        creatorTotals.set(creatorId, { totalViews: viewCount, totalNet: 0 });
      }
    }

    let totalBatchEarnings = 0;

    // 4. Process payouts per reel inside transactions
    for (const [reelId, { creatorId, viewCount }] of reelViewsMap.entries()) {
      if (viewCount < 1) continue;

      try {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const grossEarnings = (viewCount * ratePer1000) / 1000;
          const tds = grossEarnings * (tdsPercent / 100);
          const platformFee = grossEarnings * (platformFeePercent / 100);
          const netEarnings = grossEarnings - tds - platformFee;

          if (netEarnings > 0) {
            totalBatchEarnings += netEarnings;

            const creatorTotal = creatorTotals.get(creatorId)!;
            creatorTotal.totalNet += netEarnings;

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

            // Create Ledger Entry WITH reelId
            await tx.walletLedger.create({
              data: {
                userId: creatorId,
                walletId: wallet.id,
                source: 'VIEW_EARNING',
                sourceId: batch.id,
                reelId: reelId,
                credit: netEarnings,
                balanceAfter: wallet.withdrawableBalance,
                description: `Reel earnings for ${viewCount} views. Gross: ₹${grossEarnings.toFixed(2)}, TDS: ₹${tds.toFixed(2)}, Fee: ₹${platformFee.toFixed(2)}`,
              },
            });

            // Mark views for this reel as processed
            await tx.validView.updateMany({
              where: { isProcessed: false, reelId },
              data: { isProcessed: true, batchId: batch.id },
            });
          }
        });
      } catch (error) {
        this.logger.error(
          `Failed to process earnings for reel ${reelId}:`,
          error,
        );
      }
    }

    // 5. Send one notification per creator
    for (const [creatorId, { totalViews, totalNet }] of creatorTotals.entries()) {
      if (totalNet > 0) {
        await this.prisma.notification.create({
          data: {
            userId: creatorId,
            type: 'SYSTEM',
            title: 'Earnings Updated!',
            body: `You just earned ₹${totalNet.toFixed(2)} from ${totalViews} valid views!`,
          },
        }).catch(() => {}); // non-critical
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
      `Hourly earnings calculation completed. Batch ID: ${batch.id}. Total Creators: ${creatorTotals.size}. Total Net Payout: ₹${totalBatchEarnings}`,
    );
  }

private async checkReferralUnlockEligibility(
    tx: Prisma.TransactionClient | PrismaService,
    userId: string,
  ): Promise<boolean> {
    const referralAsReferrer = await tx.referralTracker.findFirst({
      where: { referrerId: userId },
    });
    const referralAsReferred = await tx.referralTracker.findFirst({
      where: { referredId: userId },
    });

    if (!referralAsReferrer && !referralAsReferred) return false;

    const counterpartId = referralAsReferrer
      ? referralAsReferrer.referredId
      : referralAsReferred!.referrerId;

    const myReelCount = await tx.reel.count({ where: { creatorId: userId } });
    if (myReelCount < 1) return false;

    const counterpartReelCount = await tx.reel.count({
      where: { creatorId: counterpartId },
    });
    if (counterpartReelCount < 1) return false;

    const myKyc = await tx.kYCRecord.findFirst({
      where: { userId, status: 'APPROVED' },
    });
    if (!myKyc) return false;

    const counterpartKyc = await tx.kYCRecord.findFirst({
      where: { userId: counterpartId, status: 'APPROVED' },
    });
    if (!counterpartKyc) return false;

    return true;
  }

  async unlockReferralBalanceIfEligible(userId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || wallet.referralLockedBalance <= 0) return wallet;

      const eligible = await this.checkReferralUnlockEligibility(tx, userId);
      if (!eligible) return wallet;

      const amount = wallet.referralLockedBalance;
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          referralLockedBalance: { decrement: amount },
          withdrawableBalance: { increment: amount },
        },
      });

      await tx.walletLedger.create({
        data: {
          userId,
          walletId: wallet.id,
          source: 'ADJUSTMENT',
          sourceId: 'REFERRAL_UNLOCK',
          credit: amount,
          balanceAfter: updatedWallet.withdrawableBalance,
          description: `Unlocked ₹${amount.toFixed(2)} referral bonus (1 reel + KYC completed by both parties)`,
        },
      });

      return updatedWallet;
    });
  }

  async getBalance(userId: string) {
    // Auto-unlock referral balance if conditions are now met
    await this.unlockReferralBalanceIfEligible(userId).catch(() => {});

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
    let bonusEarnings = 0;

    for (const agg of ledgerAggregations) {
      if (agg.source === 'VIEW_EARNING') viewEarnings = agg._sum.credit || 0;
      if (agg.source === 'GIFT_RECEIVED') giftEarnings = agg._sum.credit || 0;
      if (agg.source === 'REFERRAL_BONUS')
        referralEarnings = agg._sum.credit || 0;
      if (agg.source === 'BONUS' || agg.source === 'CHALLENGE_REWARD')
        bonusEarnings += agg._sum.credit || 0;
    }

    return {
      ...targetWallet,
      viewEarnings,
      giftEarnings,
      referralEarnings,
      bonusEarnings,
    };
  }

  async withdraw(userId: string, dto: WithdrawDto) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException('Wallet not found');

    const kyc = await tx.kYCRecord.findFirst({
        where: { userId, status: 'APPROVED' },
      });
      if (!kyc)
        throw new BadRequestException(
          'KYC must be completed and approved before withdrawal',
        );

      // Auto-unlock referral balance into withdrawableBalance if eligible.
      // This NEVER blocks withdrawal of view/gift earnings — only affects
      // referral money, which moves itself into the free pool when ready.
      const eligible = await this.checkReferralUnlockEligibility(tx, userId);
      if (eligible && wallet.referralLockedBalance > 0) {
        const lockedAmount = wallet.referralLockedBalance;
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            referralLockedBalance: { decrement: lockedAmount },
            withdrawableBalance: { increment: lockedAmount },
          },
        });
        await tx.walletLedger.create({
          data: {
            userId,
            walletId: wallet.id,
            source: 'ADJUSTMENT',
            sourceId: 'REFERRAL_UNLOCK',
            credit: lockedAmount,
            balanceAfter: wallet.withdrawableBalance + lockedAmount,
            description: `Unlocked ₹${lockedAmount.toFixed(2)} referral bonus (1 reel + KYC completed by both parties)`,
          },
        });
        wallet.withdrawableBalance += lockedAmount;
      }

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
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

  async promotePendingToWithdrawable() {
    this.logger.log(
      'Starting promotion of pending balances to withdrawable...',
    );

    const wallets = await this.prisma.wallet.findMany({
      where: { pendingBalance: { gt: 0 } },
    });

    let promotedCount = 0;
    let totalPromoted = 0;

    for (const wallet of wallets) {
      const amount = wallet.pendingBalance;
      const updatedWallet = await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: 0,
          withdrawableBalance: { increment: amount },
        },
      });
      promotedCount++;
      totalPromoted += amount;

      await this.prisma.walletLedger.create({
        data: {
          userId: wallet.userId,
          walletId: wallet.id,
          source: 'ADJUSTMENT', // Fixed: Use ADJUSTMENT instead of REFERRAL_BONUS
          sourceId: 'PROMOTION_JOB',
          credit: amount,
          balanceAfter: updatedWallet.withdrawableBalance,
          description: `Promoted ₹${amount.toFixed(2)} from pending to withdrawable balance.`,
        },
      });
    }

    this.logger.log(
      `Promotion complete. ${promotedCount} wallets updated. Total ₹${totalPromoted} promoted.`,
    );
    return { success: true, promotedCount, totalPromoted };
  }
}
