import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { RecruitersController } from './recruiters.controller';
import { RecruitersService } from './recruiters.service';

@Module({
    imports: [DatabaseModule],
    controllers: [RecruitersController],
    providers: [RecruitersService],
    exports: [RecruitersService],
})
export class RecruitersModule { }