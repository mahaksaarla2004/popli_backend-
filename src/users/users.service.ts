import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto, UpdatePreferencesDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        wallet: true,
        interests: true,
        reels: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    // Auto-sync followers/following count to fix any drift
    const actualFollowers = await this.prisma.follows.count({ where: { followingId: userId } });
    const actualFollowing = await this.prisma.follows.count({ where: { followerId: userId } });
    
    if (user.followersCount !== actualFollowers || user.followingCount !== actualFollowing) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { followersCount: actualFollowers, followingCount: actualFollowing }
      });
      user.followersCount = actualFollowers;
      user.followingCount = actualFollowing;
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Validate DOB 13+
    if (dto.dob) {
      const dobDate = new Date(dto.dob);
      const age =
        (Date.now() - dobDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 13) {
        throw new BadRequestException(
          'You must be at least 13 years old to create an account.',
        );
      }
    }

    // Uniqueness and Reserved Word checks
    if (dto.username) {
      dto.username = dto.username.toLowerCase();
      const reservedUsernames = ['admin', 'support', 'official', 'popli', 'team', 'help', 'security', 'moderator', 'root', 'system'];
      if (reservedUsernames.includes(dto.username)) {
        throw new BadRequestException('This username is reserved and cannot be claimed.');
      }

      const existing = await this.prisma.user.findFirst({
        where: { username: dto.username, id: { not: userId } },
      });
      if (existing) throw new BadRequestException('Username is already taken');
    }

    const { interestIds, interestNames, dob, referredByCode, ...restDto } = dto;

    const data: any = { ...restDto };

    if (referredByCode) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.referredById) {
        throw new BadRequestException('You have already used a referral code.');
      }
      if (user?.referralCode === referredByCode) {
        throw new BadRequestException('You cannot use your own referral code.');
      }
      const referrer = await this.prisma.user.findUnique({ where: { referralCode: referredByCode } });
      if (!referrer) {
        throw new BadRequestException('Invalid referral code.');
      }
      
      data.referredById = referrer.id;

      // Create Referral Tracker
      await this.prisma.referralTracker.create({
        data: {
          referrerId: referrer.id,
          referredId: userId,
          status: 'PENDING'
        }
      });
    }

    if (dob) {
      data.dob = new Date(dob);
    }

    // if interestIds provided, connect them
    if (interestIds) {
      data.interests = {
        set: interestIds.map((id) => ({ id })),
      };
    }

    // if interestNames provided, connect or create them
    if (interestNames) {
      data.interests = {
        connectOrCreate: interestNames.map((name) => ({
          where: { name },
          create: { name },
        })),
      };
    }

    // update the DB
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { interests: true },
    });



    // Check completion criteria
    if (!updatedUser.isProfileComplete) {
      // Must have name, username, and at least 1 interest
      if (
        updatedUser.name &&
        updatedUser.name !== 'Popli User' &&
        updatedUser.username &&
        !updatedUser.username.startsWith('user_') &&
        updatedUser.interests.length > 0
      ) {
        return this.prisma.user.update({
          where: { id: userId },
          data: { isProfileComplete: true },
          include: { interests: true },
        });
      }
    }

    return updatedUser;
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.userPreference.update({
      where: { userId },
      data: dto,
    });
  }

  async getReferrals(userId: string) {
    const referrals = await this.prisma.referralTracker.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    const referredUserIds = referrals.map(r => r.referredId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: referredUserIds } },
      select: { id: true, name: true, username: true, avatar: true }
    });

    return referrals.map(r => {
      const user = users.find(u => u.id === r.referredId);
      return {
        ...r,
        referredUser: user || null
      };
    });
  }

  async getCreatorProfile(username: string) {
    const creator = await this.prisma.user.findUnique({
      where: { username },
      include: {
        reels: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!creator) throw new NotFoundException('Creator not found');

    // Auto-sync followers/following count to fix any drift
    const actualFollowers = await this.prisma.follows.count({ where: { followingId: creator.id } });
    const actualFollowing = await this.prisma.follows.count({ where: { followerId: creator.id } });
    
    if (creator.followersCount !== actualFollowers || creator.followingCount !== actualFollowing) {
      await this.prisma.user.update({
        where: { id: creator.id },
        data: { followersCount: actualFollowers, followingCount: actualFollowing }
      });
      creator.followersCount = actualFollowers;
      creator.followingCount = actualFollowing;
    }

    return creator;
  }

  async getCreators() {
    return this.prisma.user.findMany({
      where: {
        reels: { some: {} }, // Users who have at least one reel
      },
      orderBy: { followersCount: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        bio: true,
        city: true,
        category: true,
        followersCount: true,
        isVerified: true,
      },
    });
  }

  async searchUsers(query: string) {
    if (!query || query.trim() === '') {
      return this.prisma.user.findMany({
        orderBy: { followersCount: 'desc' },
        take: 20,
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          isVerified: true,
        },
      });
    }
    return this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        isVerified: true,
      },
    });
  }
}
