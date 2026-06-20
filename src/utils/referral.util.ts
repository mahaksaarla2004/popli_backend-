import { PrismaClient } from '@prisma/client';

export async function checkAndProcessReferral(prisma: any, userId: string) {
  const tracker = await prisma.referralTracker.findFirst({
    where: { referredId: userId, status: 'PENDING' }
  });
  if (!tracker) return false;

  try {
    return await prisma.$transaction(async (tx: any) => {
      // Database-level compare-and-swap to absolutely prevent race conditions
      // This ensures we only update if rewardGranted is false AT THE MOMENT OF THE WRITE
      const updateResult = await tx.referralTracker.updateMany({ 
        where: { 
          id: tracker.id,
          status: 'PENDING',
          rewardGranted: false
        }, 
        data: { 
          status: 'COMPLETED', 
          rewardInr: 100,
          rewardGranted: true,
          rewardGrantedAt: new Date()
        }
      });

      // If count is 0, another concurrent request already processed this exact referral
      if (updateResult.count === 0) {
        return false;
      }

      // Referrer ₹100
      const referrerWallet = await tx.wallet.upsert({
        where: { userId: tracker.referrerId },
        create: { userId: tracker.referrerId },
        update: {}
      });
      await tx.wallet.update({
        where: { id: referrerWallet.id },
        data: { withdrawableBalance: { increment: 100 }, totalEarnings: { increment: 100 } }
      });
      await tx.walletLedger.create({
        data: {
            userId: tracker.referrerId,
            walletId: referrerWallet.id,
            source: 'REFERRAL_BONUS',
            sourceId: tracker.id,
            credit: 100,
            balanceAfter: referrerWallet.withdrawableBalance + 100,
            description: 'Referral Bonus for a new signup'
        }
      });

      // Referred User ₹25
      const referredWallet = await tx.wallet.upsert({
        where: { userId: userId },
        create: { userId: userId },
        update: {}
      });
      await tx.wallet.update({
        where: { id: referredWallet.id },
        data: { withdrawableBalance: { increment: 25 }, totalEarnings: { increment: 25 } }
      });
      await tx.walletLedger.create({
        data: {
            userId: userId,
            walletId: referredWallet.id,
            source: 'REFERRAL_BONUS',
            sourceId: tracker.id,
            credit: 25,
            balanceAfter: referredWallet.withdrawableBalance + 25,
            description: 'Signup Bonus from referral'
        }
      });

      // Notify Referrer
      await tx.notification.create({
        data: {
          userId: tracker.referrerId,
          type: 'SYSTEM',
          title: 'Referral Bonus!',
          body: 'You earned ₹100 because your referred friend signed up!'
        }
      });

      // Notify Referred
      await tx.notification.create({
        data: {
          userId: userId,
          type: 'SYSTEM',
          title: 'Welcome Bonus!',
          body: 'You earned ₹25 for signing up with a referral code!'
        }
      });

      return true;
    });
  } catch (err) {
    console.error('Failed to process referral rewards:', err);
    return false;
  }
}
