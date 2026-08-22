import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { SkillsModule } from './skills/skills.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { RecruitersModule } from './recruiters/recruiters.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    SkillsModule,
    CompaniesModule,
    RecruitersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }