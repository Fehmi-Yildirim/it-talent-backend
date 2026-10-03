import { Module } from '@nestjs/common'

import { SettingsModule } from '../settings/settings.module'
import { ApplicationsController } from './applications.controller'
import { ApplicationsService } from './applications.service'
import { CvRetentionService } from './cv-retention.service'

@Module({
    imports: [SettingsModule],
    controllers: [ApplicationsController],
    providers: [
        ApplicationsService,
        CvRetentionService,
    ],
})
export class ApplicationsModule { }