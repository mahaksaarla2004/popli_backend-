import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReelsModule } from './reels/reels.module';
import { StoriesModule } from './stories/stories.module';
import { ChatModule } from './chat/chat.module';
import { SocialModule } from './social/social.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WalletModule } from './wallet/wallet.module';
import { GiftsModule } from './gifts/gifts.module';
import { KycModule } from './kyc/kyc.module';
import { SupportModule } from './support/support.module';
import { AdminModule } from './admin/admin.module';
import { UploadModule } from './upload/upload.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SearchModule } from './search/search.module';
import { InterestsModule } from './interests/interests.module';
import { ChallengesModule } from './challenges/challenges.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100, // 100 requests per minute
      },
    ]),
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ReelsModule,
    StoriesModule,
    ChatModule,
    SocialModule,
    NotificationsModule,
    WalletModule,
    GiftsModule,
    KycModule,
    SupportModule,
    AdminModule,
    UploadModule,
    AnalyticsModule,
    SearchModule,
    InterestsModule,
    ChallengesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
