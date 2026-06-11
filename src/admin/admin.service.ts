import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, passwordString: string) {
    const admin = await this.prisma.user.findFirst({
      where: { email, role: 'ADMIN' },
    });

    if (!admin) {
      // In a fresh setup, we might auto-create an admin if none exists for demo purposes
      const existingAdminsCount = await this.prisma.user.count({
        where: { role: 'ADMIN' },
      });
      if (
        existingAdminsCount === 0 &&
        email === 'admin@popli.com' &&
        passwordString === 'admin123'
      ) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const newAdmin = await this.prisma.user.create({
          data: {
            name: 'Super Admin',
            username: 'popli_admin',
            email: 'admin@popli.com',
            passwordHash: hashedPassword,
            role: 'ADMIN',
            isVerified: true,
          },
        });
        const token = this.jwtService.sign({
          sub: newAdmin.id,
          role: newAdmin.role,
        });
        return {
          token,
          user: { id: newAdmin.id, name: newAdmin.name, email: newAdmin.email },
        };
      }
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const isMatch = await bcrypt.compare(
      passwordString,
      admin.passwordHash || '',
    );
    if (!isMatch) throw new UnauthorizedException('Invalid password');

    const token = this.jwtService.sign({ sub: admin.id, role: admin.role });
    return {
      token,
      user: { id: admin.id, name: admin.name, email: admin.email },
    };
  }

  async getDashboardStats(adminId: string) {
    const totalUsers = await this.prisma.user.count({
      where: { role: 'USER' },
    });
    const totalCreators = await this.prisma.user.count({
      where: { role: 'CREATOR' },
    });
    const totalReels = await this.prisma.reel.count();
    const pendingWithdrawals = await this.prisma.transaction.count({
      where: { type: 'WITHDRAWAL', status: 'PENDING' },
    });

    return { totalUsers, totalCreators, totalReels, pendingWithdrawals };
  }

  async getPendingKyc() {
    return this.prisma.kYCRecord.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, username: true, name: true } } },
    });
  }

  async approveKyc(kycId: string, adminId: string) {
    // Basic admin verification
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');

    const kyc = await this.prisma.kYCRecord.update({
      where: { id: kycId },
      data: { status: 'APPROVED', reviewedAt: new Date() },
    });

    // Update user verification badge
    await this.prisma.user.update({
      where: { id: kyc.userId },
      data: { isVerified: true, role: 'CREATOR' },
    });

    return { message: 'KYC Approved successfully' };
  }

  async suspendUser(userId: string, adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: 'USER', isVerified: false },
    });
  }

  async deleteReel(reelId: string, adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');

    return this.prisma.reel.delete({ where: { id: reelId } });
  }

  async getUsers(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReels(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');
    return this.prisma.reel.findMany({
      include: {
        creator: { select: { username: true, name: true, avatar: true } },
        taggedUsers: { select: { username: true, id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTransactions(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');
    return this.prisma.transaction.findMany({
      include: {
        wallet: {
          include: { user: { select: { username: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReports(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');
    return this.prisma.report.findMany({
      include: {
        reporter: { select: { username: true, name: true } },
        reel: {
          select: {
            description: true,
            creator: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTickets(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');
    return this.prisma.supportTicket.findMany({
      include: { creator: { select: { username: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Transactions & Withdrawals
  async approveTransaction(txId: string, adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');

    return this.prisma.transaction.update({
      where: { id: txId },
      data: { status: 'SUCCESS' },
    });
  }

  async rejectTransaction(txId: string, adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: txId },
      });
      if (!transaction || transaction.status !== 'PENDING') {
        throw new BadRequestException(
          'Transaction not found or already processed',
        );
      }

      // If it's a withdrawal in INR, refund the INR earnings to wallet
      if (transaction.type === 'WITHDRAWAL' && transaction.currency === 'INR') {
        await tx.wallet.update({
          where: { id: transaction.walletId },
          data: { inrEarnings: { increment: transaction.amount } },
        });
      }

      return tx.transaction.update({
        where: { id: txId },
        data: { status: 'FAILED' },
      });
    });
  }

  // Gifts
  async getGifts() {
    return this.prisma.gift.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async addGift(data: any, adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');

    return this.prisma.gift.create({
      data: {
        name: data.name,
        costInCoins: data.coinPrice,
        iconUrl: data.icon,
        animationType: data.animationType || 'fly',
      },
    });
  }

  async deleteGift(giftId: string, adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN')
      throw new UnauthorizedException('Not authorized');

    return this.prisma.gift.delete({
      where: { id: giftId },
    });
  }
}
