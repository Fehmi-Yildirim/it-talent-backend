import { Module } from '@nestjs/common'

import { SettingsModule } from '../settings/settings.module'
import { CandidatesController } from './candidates.controller'
import { CandidatesService } from './candidates.service'
import { CandidateSkillsModule } from './skills/candidate-skills.module'

@Module({
  imports: [CandidateSkillsModule, SettingsModule],
  controllers: [CandidatesController],
  providers: [CandidatesService],
})
export class CandidatesModule { }