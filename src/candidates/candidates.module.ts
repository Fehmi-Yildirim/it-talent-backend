import { Module } from '@nestjs/common';

import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { CandidateSkillsModule } from './skills/candidate-skills.module';

@Module({
    imports: [CandidateSkillsModule],
    controllers: [CandidatesController],
    providers: [CandidatesService],
})
export class CandidatesModule { }