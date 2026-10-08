import { Module } from '@nestjs/common'

import { SettingsModule } from '../settings/settings.module'
import { CandidateSkillsModule } from './skills/candidate-skills.module'
import { CandidatesController } from './candidates.controller'
import { CandidatesService } from './candidates.service'

@Module({
  imports: [
    CandidateSkillsModule,
    SettingsModule,
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService],
})
export class CandidatesModule { }