import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CandidateSkillsController } from './candidate-skills.controller';
import { CandidateSkillsService } from './candidate-skills.service';
import { MatchingModule } from '../../matching/matching.module';

@Module({
  imports: [DatabaseModule, MatchingModule],
  controllers: [CandidateSkillsController],
  providers: [CandidateSkillsService],
  exports: [CandidateSkillsService],
})
export class CandidateSkillsModule { }
