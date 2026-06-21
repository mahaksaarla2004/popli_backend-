import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendGiftDto } from './dto/gifts.dto';

@Injectable()
export class GiftsService {
  constructor(private prisma: PrismaService) {}

  async getGifts() {
    return this.prisma.gift.findMany();
  }

  async sendGift(senderId: string, dto: SendGiftDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const gift = await tx.gift.findUnique({ where: { id: dto.giftId } });
      if (!gift) throw new NotFoundException('Gift not found');

      const senderWallet = await tx.wallet.findUnique({
        where: { userId: senderId },
      });
      const receiverWallet = await tx.wallet.upsert({
        where: { userId: dto.receiverId },
        create: { userId: dto.receiverId },
        update: {},
      });

      if (!senderWallet)
        throw new BadRequestException('Sender wallet not found');

      const costInCoins = gift.costInCoins > 0 ? gift.costInCoins : dto.cost;

      const baseEarnings =
        gift.costInINR > 0 ? gift.costInINR : costInCoins * 0.5;
      
      // According to business logic: 60% goes to the creator, 40% is company profit.
      // 2% fee is strictly for withdrawal, not for gift revenue.
      const companyProfit = (baseEarnings * 40) / 100;
      const earningsInINR = baseEarnings - companyProfit;

      if (costInCoins > 0 && senderWallet.coinBalance < costInCoins) {
        throw new BadRequestException('Insufficient coins');
      }

      const receiverUser = await tx.user.findUnique({
        where: { id: dto.receiverId },
        select: { name: true, username: true }
      });
      const receiverName = receiverUser?.name || receiverUser?.username || 'User';

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
            description: dto.message || `Sent gift: ${gift.name} to ${receiverName}`,
          },
        });
      }

      // 2. Credit receiver's Pending Balance
      const updatedReceiverWallet = await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: {
          pendingBalance: { increment: earningsInINR },
          totalEarnings: { increment: earningsInINR },
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
          description: `Received gift: ${gift.name} from user ${senderId}`,
        },
      });

      return {
        message: 'Gift sent successfully',
        gift,
        earnings: earningsInINR,
      };
    }, {
      maxWait: 15000,
      timeout: 15000,
    });

    // 4. Send Notification OUTSIDE the transaction for speed
    try {
      const existingNotif = await this.prisma.notification.findFirst({
        where: {
          userId: dto.receiverId,
          senderId: senderId,
          type: 'GIFT' as any,
          postId: dto.reelId || null,
          commentId: null,
          replyId: null,
        }
      });

      if (existingNotif) {
        await this.prisma.notification.update({
          where: { id: existingNotif.id },
          data: {
            body: `sent you another ${result.gift.name}!`,
            isRead: false,
            updatedAt: new Date()
          }
        });
      } else {
        await this.prisma.notification.create({
          data: {
            userId: dto.receiverId,
            senderId: senderId,
            type: 'GIFT' as any,
            title: 'You received a gift!',
            body: `sent you a ${result.gift.name}`,
            postId: dto.reelId,
            metaData: {
              giftId: result.gift.id,
              giftType: result.gift.name,
              giftAmount: result.earnings,
              targetType: 'REEL',
            },
          },
        });
      }
    } catch (err) {
      console.error('Failed to send gift notification:', err);
    }

    return result;
  }
}
