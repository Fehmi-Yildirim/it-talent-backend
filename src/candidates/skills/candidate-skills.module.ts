import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { CandidateSkillsController } from './candidate-skills.controller';
import { CandidateSkillsService } from './candidate-skills.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CandidateSkillsController],
  providers: [CandidateSkillsService],
  exports: [CandidateSkillsService],
})
export class CandidateSkillsModule {}
