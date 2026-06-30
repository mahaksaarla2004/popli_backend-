import { PrismaClient } from '@prisma/client';

export async function checkAndProcessReferral(prisma: any, userId: string) {
  const tracker = await prisma.referralTracker.findFirst({
    where: { referredId: userId, status: 'PENDING' },
  });
  if (!tracker) return false;

  const kyc = await prisma.kYCRecord.findFirst({
    where: { userId, status: 'APPROVED' },
  });
  if (!kyc) return false;

  const firstReel = await prisma.reel.findFirst({
    where: { creatorId: userId },
  });
  if (!firstReel) return false;

  try {
    return await prisma.$transaction(async (tx: any) => {
      // Atomically check and mark as complete
      const updateResult = await tx.referralTracker.updateMany({
        where: { id: tracker.id, status: 'PENDING' },
        data: { status: 'COMPLETED', rewardInr: 100 },
      });

      if (updateResult.count === 0) return false;

      // Referrer ₹100 (locked until both parties have reel + approved KYC)
      const referrerWallet = await tx.wallet.upsert({
        where: { userId: tracker.referrerId },
        create: { userId: tracker.referrerId },
        update: {},
      });
      await tx.wallet.update({
        where: { id: referrerWallet.id },
        data: {
          referralLockedBalance: { increment: 100 },
          totalEarnings: { increment: 100 },
        },
      });
      await tx.walletLedger.create({
        data: {
          userId: tracker.referrerId,
          walletId: referrerWallet.id,
          source: 'REFERRAL_BONUS',
          sourceId: tracker.id,
          credit: 100,
          balanceAfter: referrerWallet.withdrawableBalance,
          description:
            'Referral Bonus for a verified signup (locked until both parties complete reel + KYC)',
        },
      });

      // Referred User ₹25 (locked until both parties have reel + approved KYC)
      const referredWallet = await tx.wallet.upsert({
        where: { userId: userId },
        create: { userId: userId },
        update: {},
      });
      await tx.wallet.update({
        where: { id: referredWallet.id },
        data: {
          referralLockedBalance: { increment: 25 },
          totalEarnings: { increment: 25 },
        },
      });
      await tx.walletLedger.create({
        data: {
          userId: userId,
          walletId: referredWallet.id,
          source: 'REFERRAL_BONUS',
          sourceId: tracker.id,
          credit: 25,
          balanceAfter: referredWallet.withdrawableBalance,
          description: 'Signup Bonus for completing KYC and First Post (locked until both parties complete reel + KYC)',
        },
      });

      // Notify Referrer
      await tx.notification.create({
        data: {
          userId: tracker.referrerId,
          type: 'SYSTEM',
          title: 'Referral Bonus!',
          body: 'You earned ₹100 because your referred friend completed their KYC and posted their first reel!',
        },
      });

      // Notify Referred
      await tx.notification.create({
        data: {
          userId: userId,
          type: 'SYSTEM',
          title: 'Welcome Bonus!',
          body: 'You earned ₹25 for completing your KYC and posting your first reel!',
        },
      });

      return true;
    });
  } catch (err) {
    console.error('Failed to process referral rewards:', err);
    return false;
  }
}