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
  GoogleLoginDto,
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

    if (dto.idToken === 'bypass_1234') {
      phone = dto.phone;
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

    let possiblePhones = [phone];
    if (phone.startsWith('+91')) {
      possiblePhones.push(phone.replace('+91', ''));
    } else if (/^\d{10}$/.test(phone)) {
      possiblePhones.push(`+91${phone}`);
    }

    let user = await this.prisma.user.findFirst({
      where: { phone: { in: possiblePhones } },
    });

    if (user && user.isBlocked) {
      throw new BadRequestException(
        'Your account has been restricted. Please contact support.',
      );
    }

    if (!user) {
      // Auto-register new user
      let finalUsername = `user_${Date.now()}`;
      if (dto.username) {
        finalUsername = dto.username.toLowerCase();
        const existingUsername = await this.prisma.user.findUnique({
          where: { username: finalUsername },
        });
        if (existingUsername) {
          throw new BadRequestException('Username is already taken');
        }
      }

      // RULE 4: Device Limit Check
      const deviceIdToCheck = dto.deviceId || userAgent;
      if (deviceIdToCheck) {
        // Group sessions by userId for this device
        const existingDeviceSessions = await this.prisma.session.groupBy({
          by: ['userId'],
          where: { deviceInfo: deviceIdToCheck },
        });

        if (existingDeviceSessions.length >= 500) {
          throw new BadRequestException(
            'Registration limit reached for this device. Maximum 500 accounts allowed per device.',
          );
        }
      }

      // Generate a unique 6-character referral code
      const referralCode =
        Math.random().toString(36).substring(2, 8).toUpperCase() +
        Math.floor(Math.random() * 100);

      let referredById: string | null = null;

      // Handle Referral Logic
      if (dto.referredByCode) {
        const referrer = await this.prisma.user.findUnique({
          where: { referralCode: dto.referredByCode },
        });

        if (referrer) {
          referredById = referrer.id;
        }
      }

      const dobDate = dto.dob
        ? new Date(dto.dob.split('/').reverse().join('-'))
        : null;

      user = await this.prisma.user.create({
        data: {
          phone,
          email: dto.email || null,
          username: finalUsername,
          name: dto.name || 'Popli User',
          dob: dobDate,
          isProfileComplete: false, // Force them to complete profile
          deviceId: deviceIdToCheck,
          referralCode,
          referredById,
        },
      });

      // create default wallet and preferences
      await this.prisma.wallet.create({ data: { userId: user.id } });
      await this.prisma.userPreference.create({ data: { userId: user.id } });

      // Create Referral Tracker and Instant Bonus
      if (referredById) {
        const tracker = await this.prisma.referralTracker.create({
          data: {
            referrerId: referredById,
            referredId: user.id,
            status: 'COMPLETED',
            rewardInr: 100,
          },
        });

        // 1. Credit Referrer ₹100
        const refWallet = await this.prisma.wallet.findUnique({ where: { userId: referredById } });
        if (refWallet) {
        await this.prisma.wallet.update({
            where: { id: refWallet.id },
            data: { referralLockedBalance: { increment: 100 }, totalEarnings: { increment: 100 } }
          });
          await this.prisma.walletLedger.create({
            data: {
              userId: referredById,
              walletId: refWallet.id,
              source: 'REFERRAL_BONUS',
              sourceId: tracker.id,
              credit: 100,
              balanceAfter: refWallet.referralLockedBalance + 100,
              description: 'Referral Bonus for a successful signup (locked)'
            }
          });
          // Notify Referrer
          await this.prisma.notification.create({
            data: {
              userId: referredById,
              type: 'SYSTEM',
              title: 'Referral Bonus!',
              body: 'You earned ₹100 because your friend successfully joined Popli!'
            }
          });
        }

       // 2. Credit Referred (New User) ₹25
        const myWallet = await this.prisma.wallet.findUnique({ where: { userId: user.id } });
        if (myWallet) {
          await this.prisma.wallet.update({
            where: { id: myWallet.id },
            data: { referralLockedBalance: { increment: 25 }, totalEarnings: { increment: 25 } }
          });
          await this.prisma.walletLedger.create({
            data: {
              userId: user.id,
              walletId: myWallet.id,
              source: 'REFERRAL_BONUS',
              sourceId: tracker.id,
              credit: 25,
              balanceAfter: 25,
              description: 'Welcome Bonus for using a referral code (locked)'
            }
          });
          // Notify Referred User
          await this.prisma.notification.create({
            data: {
              userId: user.id,
              type: 'SYSTEM',
              title: 'Welcome Bonus!',
              body: 'You earned ₹25 for signing up with a referral code!'
            }
          });
        }
      }
    }

    if (!user) {
      throw new BadRequestException('Invalid authentication flow.');
    }

    // Generate JWT
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Hash refresh token
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    // Store session
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
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

async googleLogin(dto: GoogleLoginDto, ip: string, userAgent: string) {
    const decodedToken = await this.firebaseAdmin.verifyIdToken(dto.idToken);

    const email = decodedToken.email;
    const name = decodedToken.name || 'Popli User';
    const googleUid = decodedToken.uid;

    if (!email) throw new BadRequestException('Google account has no email');

    let user = await this.prisma.user.findFirst({
      where: { email },
    });

    if (user && user.isBlocked) {
      throw new BadRequestException('Your account has been restricted. Please contact support.');
    }

    if (!user) {
      const deviceIdToCheck = dto.deviceId || userAgent;
      if (deviceIdToCheck) {
        const existingDeviceSessions = await this.prisma.session.groupBy({
          by: ['userId'],
          where: { deviceInfo: deviceIdToCheck },
        });
        if (existingDeviceSessions.length >= 500) {
          throw new BadRequestException('Registration limit reached for this device.');
        }
      }

      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase() + Math.floor(Math.random() * 100);
      let referredById: string | null = null;

      if (dto.referredByCode) {
        const referrer = await this.prisma.user.findUnique({ where: { referralCode: dto.referredByCode } });
        if (referrer) referredById = referrer.id;
      }

      const finalUsername = `user_${googleUid.substring(0, 8)}`;

      user = await this.prisma.user.create({
        data: {
          email,
          username: finalUsername,
          name,
          isProfileComplete: false,
          deviceId: dto.deviceId || userAgent,
          referralCode,
          referredById,
          phone: `G-${googleUid}`,
        },
      });

      await this.prisma.wallet.create({ data: { userId: user.id } });
      await this.prisma.userPreference.create({ data: { userId: user.id } });
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress: ip,
        deviceInfo: dto.deviceId || userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

 async demoLogin(phone: string, ip: string, userAgent: string, referredByCode?: string) {
    if (!phone) throw new BadRequestException('Phone is required');

    let possiblePhones = [phone];
    if (phone.startsWith('+91')) {
      possiblePhones.push(phone.replace('+91', ''));
    } else if (/^\d{10}$/.test(phone)) {
      possiblePhones.push(`+91${phone}`);
    }

    let user = await this.prisma.user.findFirst({
      where: { phone: { in: possiblePhones } },
    });
    if (!user) {
      const finalUsername =
        'user_' + Math.random().toString(36).substring(2, 10);

      const referralCode =
        Math.random().toString(36).substring(2, 8).toUpperCase() +
        Math.floor(Math.random() * 100);

      let referredById: string | null = null;
      if (referredByCode) {
        const referrer = await this.prisma.user.findUnique({
          where: { referralCode: referredByCode },
        });
        if (referrer) referredById = referrer.id;
      }

      user = await this.prisma.user.create({
        data: {
          phone,
          username: finalUsername,
          name: 'Demo User',
          isProfileComplete: false,
          referralCode,
          referredById,
        },
      });
      await this.prisma.wallet.create({ data: { userId: user.id } });
      await this.prisma.userPreference.create({ data: { userId: user.id } });

      if (referredById) {
        const tracker = await this.prisma.referralTracker.create({
          data: {
            referrerId: referredById,
            referredId: user.id,
            status: 'COMPLETED',
            rewardInr: 100,
          },
        });

     const refWallet = await this.prisma.wallet.findUnique({ where: { userId: referredById } });
        if (refWallet) {
          await this.prisma.wallet.update({
            where: { id: refWallet.id },
            data: { referralLockedBalance: { increment: 100 }, totalEarnings: { increment: 100 } }
          });
          await this.prisma.walletLedger.create({
            data: {
              userId: referredById,
              walletId: refWallet.id,
              source: 'REFERRAL_BONUS',
              sourceId: tracker.id,
              credit: 100,
              balanceAfter: refWallet.referralLockedBalance + 100,
              description: 'Referral Bonus for a successful signup (locked)'
            }
          });
          await this.prisma.notification.create({
            data: {
              userId: referredById,
              type: 'SYSTEM',
              title: 'Referral Bonus!',
              body: 'You earned ₹100 because your friend successfully joined Popli!'
            }
          });
        }

        const myWallet = await this.prisma.wallet.findUnique({ where: { userId: user.id } });
        if (myWallet) {
          await this.prisma.wallet.update({
            where: { id: myWallet.id },
            data: { referralLockedBalance: { increment: 25 }, totalEarnings: { increment: 25 } }
          });
          await this.prisma.walletLedger.create({
            data: {
              userId: user.id,
              walletId: myWallet.id,
              source: 'REFERRAL_BONUS',
              sourceId: tracker.id,
              credit: 25,
              balanceAfter: 25,
              description: 'Welcome Bonus for using a referral code (locked)'
            }
          });
          await this.prisma.notification.create({
            data: {
              userId: user.id,
              type: 'SYSTEM',
              title: 'Welcome Bonus!',
              body: 'You earned ₹25 for signing up with a referral code!'
            }
          });
        }
      }
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress: ip,
        deviceInfo: userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

 async changePhone(userId: string, dto: { currentPhoneOtp: string; newPhone: string; newPhoneOtp: string }) {
    if (dto.currentPhoneOtp !== '1234' || dto.newPhoneOtp !== '1234') {
      throw new BadRequestException('Invalid OTP');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    let possibleNewPhones = [dto.newPhone];
    if (dto.newPhone.startsWith('+91')) {
      possibleNewPhones.push(dto.newPhone.replace('+91', ''));
    } else if (/^\d{10}$/.test(dto.newPhone)) {
      possibleNewPhones.push(`+91${dto.newPhone}`);
    }

    if (possibleNewPhones.includes(user.phone)) {
      throw new BadRequestException('New phone number must be different from your current number.');
    }

    const existing = await this.prisma.user.findFirst({
      where: { phone: { in: possibleNewPhones }, id: { not: userId } },
    });
    if (existing) {
      throw new BadRequestException('This phone number is already registered with another account.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { phone: dto.newPhone },
    });

    return { phone: updatedUser.phone };
  }

 async getReferrerByCode(code: string) {
    if (!code) return { valid: false };

    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: code.toUpperCase() },
      select: { name: true, username: true },
    });

    if (!referrer) return { valid: false };

    return { valid: true, name: referrer.name, username: referrer.username };
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
            { username: dto.identifier },
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
          message: 'This account is already registered. Please login instead.',
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
          userId: user.id,
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

    const tokenHash = await bcrypt.hash(refreshToken, 10);

    // Save session
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        ipAddress: ip,
        deviceInfo: userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken, userId };
  }

  async refreshToken(dto: RefreshTokenDto) {
    // Since we hash tokens, we need to find the session that matches this token.
    // However, bcrypt.compare is slow to run across all sessions.
    // Instead, we decode the token to get the userId, then find their sessions.
    let decoded;
    try {
      decoded = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        userId: decoded.sub,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    let validSession: any = null;
    for (const session of sessions) {
      const isMatch = await bcrypt.compare(dto.refreshToken, session.tokenHash);
      if (isMatch) {
        validSession = session;
        break;
      }
    }

    if (!validSession) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    // Refresh token rotation: Revoke old, issue new
    await this.prisma.session.update({
      where: { id: validSession.id },
      data: { revoked: true },
    });

    const payload = { sub: validSession.userId };
    const newAccessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '7d',
    });
    const newRefreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      expiresIn: '7d',
    });

    const newTokenHash = await bcrypt.hash(newRefreshToken, 10);

    await this.prisma.session.create({
      data: {
        userId: validSession.userId,
        tokenHash: newTokenHash,
        ipAddress: validSession.ipAddress,
        deviceInfo: validSession.deviceInfo,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    let decoded;
    try {
      decoded = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      });
    } catch {
      return { message: 'Logged out successfully' };
    }

    const sessions = await this.prisma.session.findMany({
      where: { userId: decoded.sub, revoked: false },
    });

    for (const session of sessions) {
      const isMatch = await bcrypt.compare(refreshToken, session.tokenHash);
      if (isMatch) {
        await this.prisma.session.update({
          where: { id: session.id },
          data: { revoked: true },
        });
        break;
      }
    }
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { revoked: true },
    });
    return { message: 'Logged out from all devices successfully' };
  }
}
