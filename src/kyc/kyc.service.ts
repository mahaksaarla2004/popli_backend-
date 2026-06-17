import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitKycDto } from './dto/kyc.dto';

@Injectable()
export class KycService {
  constructor(private prisma: PrismaService) {}

  async getKycStatus(userId: string) {
    let kyc = await this.prisma.kYCRecord.findUnique({ where: { userId } });
    if (!kyc) {
      kyc = await this.prisma.kYCRecord.create({
        data: {
          userId,
          fullName: '',
          dob: '',
          status: 'NOT_SUBMITTED',
        },
      });
    }
    return kyc;
  }

  async submitKyc(userId: string, dto: SubmitKycDto) {
    const kyc = await this.prisma.kYCRecord.findUnique({ where: { userId } });

    if (kyc && kyc.status === 'APPROVED') {
      throw new BadRequestException('KYC is already approved.');
    }

    return this.prisma.kYCRecord.upsert({
      where: { userId },
      update: {
        ...dto,
        status: 'APPROVED',
        submittedAt: new Date(),
      },
      create: {
        userId,
        ...dto,
        status: 'APPROVED',
      },
    });
  }
}
