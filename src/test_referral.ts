import { PrismaClient } from '@prisma/client';
import { checkAndProcessReferral } from './utils/referral.util';

const prisma = new PrismaClient();

async function runTest() {
  console.log("=== STARTING REFERRAL TEST ===");
  try {
    // 1. Setup clean users
    const userA = await prisma.user.create({
      data: {
        name: 'User A',
        phone: '+10000000001',
        username: 'usera_ref_test',
        referralCode: 'USERA123',
        wallet: { create: { withdrawableBalance: 0, totalEarnings: 0 } }
      }
    });

    const userB = await prisma.user.create({
      data: {
        name: 'User B',
        phone: '+10000000002',
        username: 'userb_ref_test',
        referredById: userA.id,
        wallet: { create: { withdrawableBalance: 0, totalEarnings: 0 } }
      }
    });

    console.log("[+] Users created successfully");

    // 2. Create ReferralTracker, KYC, and Reel
    let tracker = await prisma.referralTracker.create({
      data: {
        referrerId: userA.id,
        referredId: userB.id,
        status: 'PENDING'
      }
    });

    await prisma.kYCRecord.create({
      data: { userId: userB.id, status: 'APPROVED', aadharNumber: '123412341234', panNumber: 'ABCDE1234F', fullName: 'User B', dob: '2000-01-01' }
    });

    await prisma.reel.create({
      data: { creatorId: userB.id, mediaUrl: 'http://test.mp4', thumbnailUrl: 'http://test.jpg' }
    });

    console.log("[+] ReferralTracker, KYC, and Reel created");

    // 3. Prevent duplicate ReferralTracker (Unique Constraint Test)
    try {
      await prisma.referralTracker.create({
        data: {
          referrerId: userA.id,
          referredId: userB.id,
          status: 'PENDING'
        }
      });
      console.log("[-] FAIL: Duplicate ReferralTracker was created.");
    } catch (err: any) {
      if (err.code === 'P2002') {
        console.log("[+] PASS: Unique constraint blocked duplicate ReferralTracker.");
      } else {
        console.log("[-] FAIL: Unexpected error for duplicate tracker", err);
      }
    }

    // 4. Run Normal Reward
    console.log("[*] Running normal reward process...");
    const success = await checkAndProcessReferral(prisma, userB.id);
    console.log(`[+] Normal reward success: ${success}`);

    // 5. Test Concurrency/Race Condition (Simulate 5 simultaneous requests on already processed reward)
    console.log("[*] Simulating race condition with 5 simultaneous reward requests...");
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(checkAndProcessReferral(prisma, userB.id));
    }
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r === true).length;
    console.log(`[+] Race condition results: ${successCount} successful reward(s) out of 5 attempts. (Expected: 0)`);

    // 5. Verify Database State
    const finalTracker = await prisma.referralTracker.findUnique({ where: { id: tracker.id } });
    const finalWalletA = await prisma.wallet.findUnique({ where: { userId: userA.id } });
    const ledgers = await prisma.walletLedger.findMany({ where: { userId: userA.id } });

    console.log("=== DB VALIDATION ===");
    console.log(`rewardGranted: ${finalTracker?.rewardGranted}`);
    console.log(`rewardGrantedAt: ${finalTracker?.rewardGrantedAt ? 'POPULATED' : 'NULL'}`);
    console.log(`WalletA withdrawableBalance: ₹${finalWalletA?.withdrawableBalance}`);
    console.log(`Ledger entries count: ${ledgers.length}`);

    // Cleanup
    await prisma.reel.deleteMany({ where: { creatorId: userB.id } });
    await prisma.kYCRecord.deleteMany({ where: { userId: userB.id } });
    await prisma.referralTracker.deleteMany({ where: { OR: [{ referrerId: userA.id }, { referrerId: userB.id }] } });
    await prisma.walletLedger.deleteMany({ where: { OR: [{ userId: userA.id }, { userId: userB.id }] } });
    await prisma.wallet.deleteMany({ where: { OR: [{ userId: userA.id }, { userId: userB.id }] } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    console.log("[+] Cleanup complete");

  } catch (err) {
    console.error("Test failed", err);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
