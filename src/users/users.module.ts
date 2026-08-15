import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CandidateSkillsModule } from './skills/candidate-skills.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [DatabaseModule, CandidateSkillsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule { }