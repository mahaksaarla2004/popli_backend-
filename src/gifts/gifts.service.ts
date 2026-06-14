import { Injectable, BadRequestException } from '@nestjs/common';
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
      const senderWallet = await tx.wallet.findUnique({
        where: { userId: senderId },
      });
      const receiverWallet = await tx.wallet.findUnique({
        where: { userId: dto.receiverId },
      });

      if (!senderWallet || !receiverWallet) {
        throw new BadRequestException('Wallet not found');
      }

      // if (senderWallet.coinBalance < dto.cost) {
      //   throw new BadRequestException('Insufficient coins');
      // }

      // Deduct coins from sender
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: { coinBalance: { decrement: dto.cost } },
      });

      await tx.transaction.create({
        data: {
          walletId: senderWallet.id,
          type: 'GIFT_SEND',
          amount: dto.cost,
          currency: 'COINS',
          status: 'SUCCESS',
          description: dto.message || 'Sent a gift',
        },
      });

      // Add INR to receiver (Conversion Rate: 1 Coin = 0.50 INR)
      const convertedEarnings = dto.cost * 0.5;

      await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: { inrEarnings: { increment: convertedEarnings } },
      });

      await tx.transaction.create({
        data: {
          walletId: receiverWallet.id,
          type: 'GIFT_RECEIVE',
          amount: convertedEarnings,
          currency: 'INR',
          status: 'SUCCESS',
          description: 'Received a gift',
        },
      });

      await tx.user.update({
        where: { id: dto.receiverId },
        data: { giftsReceivedCount: { increment: 1 } },
      });

      return { message: 'Gift sent successfully' };
    });
  }
}
