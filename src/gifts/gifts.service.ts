import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendGiftDto } from './dto/gifts.dto';

@Injectable()
export class GiftsService {
  constructor(private prisma: PrismaService) {}

  async getGifts() {
    return this.prisma.gift.findMany();
  }

  async sendGift(senderId: string, dto: SendGiftDto) {
    return this.prisma.$transaction(async (tx) => {
      const gift = await tx.gift.findUnique({ where: { id: dto.giftId } });
      if (!gift) throw new NotFoundException('Gift not found');

      const senderWallet = await tx.wallet.findUnique({ where: { userId: senderId } });
      const receiverWallet = await tx.wallet.upsert({
        where: { userId: dto.receiverId },
        create: { userId: dto.receiverId },
        update: {}
      });

      if (!senderWallet) throw new BadRequestException('Sender wallet not found');

      const costInCoins = gift.costInCoins > 0 ? gift.costInCoins : dto.cost;
      
      const feeConfig = await tx.systemConfig.findUnique({ where: { key: 'PLATFORM_FEE_PERCENTAGE' } });
      const feePercent = feeConfig && typeof feeConfig.valueJson === 'number' ? feeConfig.valueJson : 2;
      
      const baseEarnings = gift.costInINR > 0 ? gift.costInINR : (costInCoins * 0.5);
      const platformFeeDeducted = (baseEarnings * feePercent) / 100;
      const earningsInINR = baseEarnings - platformFeeDeducted;

      if (costInCoins > 0 && senderWallet.coinBalance < costInCoins) {
        throw new BadRequestException('Insufficient coins');
      }

      // 1. Deduct from sender
      if (costInCoins > 0) {
        await tx.wallet.update({
          where: { id: senderWallet.id },
          data: { coinBalance: { decrement: costInCoins } },
        });

        // We use standard transaction for coin deductions if preferred, or Ledger.
        await tx.transaction.create({
          data: {
            walletId: senderWallet.id,
            type: 'GIFT_SEND',
            amount: costInCoins,
            currency: 'COINS',
            status: 'SUCCESS',
            description: dto.message || `Sent gift: ${gift.name}`,
          },
        });
      }

      // 2. Credit receiver's Pending Balance
      const updatedReceiverWallet = await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: { 
          pendingBalance: { increment: earningsInINR },
          totalEarnings: { increment: earningsInINR } 
        },
      });

      // 3. Create Immutable Ledger Entry
      await tx.walletLedger.create({
        data: {
          userId: dto.receiverId,
          walletId: receiverWallet.id,
          source: 'GIFT_RECEIVED',
          sourceId: gift.id, // Or a unique gift transaction ID
          credit: earningsInINR,
          balanceAfter: updatedReceiverWallet.pendingBalance,
          description: `Received gift: ${gift.name} from user ${senderId}`
        }
      });

      // 4. Send Notification
      await tx.notification.create({
        data: {
          userId: dto.receiverId,
          senderId: senderId,
          type: 'LIKE', // Fallback type
          title: 'You received a gift!',
          body: `Someone sent you a ${gift.name} worth ₹${earningsInINR.toFixed(2)}!`,
        }
      });

      // Optionally update user stats if that column exists:
      await tx.user.update({
        where: { id: dto.receiverId },
        data: { /* giftsReceivedCount: { increment: 1 } */ }
      }).catch(() => null);

      return { message: 'Gift sent successfully', gift, earnings: earningsInINR };
    });
  }
}
