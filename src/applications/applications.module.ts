import { Module } from '@nestjs/common'

import { ApplicationsController } from './applications.controller'
import { ApplicationsService } from './applications.service'
import { CvRetentionService } from './cv-retention.service'

@Module({
    controllers: [ApplicationsController],
    providers: [
        ApplicationsService,
        CvRetentionService,
    ],
})
export class ApplicationsModule { }