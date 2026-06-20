import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { ChallengesGateway } from './challenges.gateway';

@Module({
  providers: [ChallengesService, ChallengesGateway],
  controllers: [ChallengesController],
  exports: [ChallengesService, ChallengesGateway],
})
export class ChallengesModule {}
