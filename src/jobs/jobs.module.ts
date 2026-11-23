import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [DatabaseModule, MatchingModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule { }
