import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPendingKyc() {
    return this.prisma.kYCRecord.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, username: true, name: true } } }
    });
  }

  async approveKyc(kycId: string, adminId: string) {
    // Basic admin verification
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') throw new UnauthorizedException('Not authorized');

    const kyc = await this.prisma.kYCRecord.update({
      where: { id: kycId },
      data: { status: 'APPROVED', reviewedAt: new Date() }
    });

    // Update user verification badge
    await this.prisma.user.update({
      where: { id: kyc.userId },
      data: { isVerified: true, role: 'CREATOR' }
    });

    return { message: 'KYC Approved successfully' };
  }

  async suspendUser(userId: string, adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') throw new UnauthorizedException('Not authorized');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: 'USER', isVerified: false }
    });
  }

  async deleteReel(reelId: string, adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') throw new UnauthorizedException('Not authorized');

    return this.prisma.reel.delete({ where: { id: reelId } });
  }
}
