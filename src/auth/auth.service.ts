import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import {
  SendOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  VerifyFirebaseTokenDto,
} from './dto/auth.dto';
import { FirebaseAdminService } from './firebase-admin.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private firebaseAdmin: FirebaseAdminService,
  ) {}

  async verifyFirebaseToken(
    dto: VerifyFirebaseTokenDto,
    ip: string,
    userAgent: string,
  ) {
    let phone: string | undefined;

    if (dto.idToken.startsWith('MOCK_TOKEN_')) {
      // Mock logic for local testing without Firebase SHA-1 setup
      phone = dto.idToken.replace('MOCK_TOKEN_', '');
    } else {
      // Real Firebase verification
      const decodedToken = await this.firebaseAdmin.verifyIdToken(dto.idToken);
      phone = decodedToken.phone_number;
    }

    if (!phone) {
      throw new BadRequestException(
        'Firebase token does not contain a phone number',
      );
    }

    let user = await this.prisma.user.findFirst({
      where: { phone },
    });

    if (user && user.isBlocked) {
      throw new BadRequestException(
        'Your account has been restricted. Please contact support.',
      );
    }

    if (!user) {
      // RULE 4: Device Limit Check
      const deviceIdToCheck = dto.deviceId || userAgent;
      if (deviceIdToCheck) {
        // Group sessions by userId for this device
        const existingDeviceSessions = await this.prisma.session.groupBy({
          by: ['userId'],
          where: { deviceInfo: deviceIdToCheck },
        });

        if (existingDeviceSessions.length >= 5) {
          throw new BadRequestException(
            'Registration limit reached for this device. Maximum 5 accounts allowed per device.',
          );
        }
      }

      // Generate a unique 6-character referral code
      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase() + Math.floor(Math.random() * 100);
      
      let referredById = null;

      // Handle Referral Logic
      if (dto.referredByCode) {
        const referrer = await this.prisma.user.findUnique({
          where: { referralCode: dto.referredByCode }
        });
        
        if (referrer) {
          referredById = referrer.id;
          // Credit referrer's wallet with ₹10
          const referrerWallet = await this.prisma.wallet.findUnique({ where: { userId: referrer.id } });
          if (referrerWallet) {
            await this.prisma.wallet.update({
              where: { userId: referrer.id },
              data: { inrEarnings: { increment: 10 } }
            });
            await this.prisma.transaction.create({
              data: {
                walletId: referrerWallet.id,
                type: 'REFERRAL_BONUS',
                amount: 10,
                currency: 'INR',
                status: 'SUCCESS',
                description: 'Referral Bonus for a new user signup'
              }
            });
          }
        }
      }

      // Auto-register as incomplete user
      user = await this.prisma.user.create({
        data: {
          phone,
          username: `user_${Date.now()}`,
          name: 'Popli User',
          isProfileComplete: false,
          deviceId: deviceIdToCheck,
          referralCode,
          referredById,
        },
      });
      // create default wallet and preferences
      await this.prisma.wallet.create({ data: { userId: user.id } });
      await this.prisma.userPreference.create({ data: { userId: user.id } });
    }

    // Generate JWT
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Store session
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        ipAddress: ip,
        deviceInfo: dto.deviceId || userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        isProfileComplete: user.isProfileComplete,
      },
    };
  }

  async checkUser(dto: any) {
    if (dto.identifier) {
      // If it's a 10-digit number without country code, also check for +91
      const isTenDigitNum = /^\d{10}$/.test(dto.identifier);
      const possiblePhones = [dto.identifier];
      if (isTenDigitNum) {
        possiblePhones.push(`+91${dto.identifier}`);
      } else if (dto.identifier.startsWith('+91')) {
        possiblePhones.push(dto.identifier.replace('+91', ''));
      }

      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { phone: { in: possiblePhones } }, 
            { email: dto.identifier },
            { username: dto.identifier }
          ],
        },
      });

      if (user) {
        if (user.isBlocked) {
          throw new BadRequestException(
            'Your account has been restricted. Please contact support.',
          );
        }
        return {
          exists: true,
          field: 'identifier',
          message:
            'This account is already registered. Please login instead.',
          userId: user.id,
          phone: user.phone,
          isProfileComplete: user.isProfileComplete,
        };
      }
    }

    if (dto.username) {
      const user = await this.prisma.user.findFirst({
        where: { username: dto.username },
      });

      if (user) {
        return {
          exists: true,
          field: 'username',
          message: 'Username is already taken.',
        };
      }
    }

    return { exists: false };
  }

  async sendOtp(dto: SendOtpDto) {
    // In our architecture, the frontend directly calls Firebase to send OTPs.
    // This endpoint exists if you want to trigger OTPs via a custom provider in the future.
    return { message: 'OTP flow is handled by Firebase on the frontend' };
  }

  async verifyOtp(dto: VerifyOtpDto, ip: string, userAgent: string) {
    // We now enforce Firebase Token verification instead of mock OTPs.
    // If you reach here with a traditional OTP, it means you are using legacy auth flow.
    throw new BadRequestException(
      'Please use Firebase Token Verification for OTPs.',
    );

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: dto.identifier }, { email: dto.identifier }],
      },
    });

    // If user exists and it's a signup request (indicated by providing a username)
    if (user && dto.username) {
      throw new BadRequestException(
        'Account already exists with this mobile number. Please log in.',
      );
    }

    if (!user) {
      // Auto-register
      const isEmail = dto.identifier.includes('@');

      let finalUsername = `user_${Date.now()}`;
      if (typeof dto.username === 'string') {
        // Enforce lowercase
        finalUsername = dto.username!.toLowerCase();
        const existingUser = await this.prisma.user.findUnique({
          where: { username: finalUsername },
        });
        if (existingUser) {
          throw new BadRequestException('Username is already taken');
        }
      }

      user = await this.prisma.user.create({
        data: {
          phone: !isEmail ? dto.identifier : null,
          email: isEmail ? dto.identifier : null,
          username: finalUsername,
          name: dto.name || 'New User',
        },
      });
      // create default wallet and preferences
      await this.prisma.wallet.create({ data: { userId: user!.id } });
      await this.prisma.userPreference.create({ data: { userId: user!.id } });
    }

    return this.generateTokens(user!.id, ip, userAgent);
  }

  private async generateTokens(userId: string, ip: string, userAgent: string) {
    const payload = { sub: userId };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '7d',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    // Save session
    await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        ipAddress: ip,
        deviceInfo: userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken, userId };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken: dto.refreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    try {
      this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload = { sub: session.userId };
    const newAccessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '7d',
    });

    return { accessToken: newAccessToken };
  }

  async logout(refreshToken: string) {
    await this.prisma.session.deleteMany({
      where: { refreshToken },
    });
    return { message: 'Logged out successfully' };
  }
}
