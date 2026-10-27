import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnvironment } from './config/env.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { CandidatesModule } from './candidates/candidates.module';
import { CompaniesModule } from './companies/companies.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { RecruitersModule } from './recruiters/recruiters.module';
import { SettingsModule } from './settings/settings.module';
import { SkillsModule } from './skills/skills.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'authLogin',
          ttl: configService.getOrThrow<number>('AUTH_LOGIN_TTL_MS'),
          limit: configService.getOrThrow<number>('AUTH_LOGIN_LIMIT'),
        },
        {
          name: 'authRegister',
          ttl: configService.getOrThrow<number>('AUTH_REGISTER_TTL_MS'),
          limit: configService.getOrThrow<number>('AUTH_REGISTER_LIMIT'),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    SkillsModule,
    CompaniesModule,
    RecruitersModule,
    JobsModule,
    CandidatesModule,
    ApplicationsModule,
    DashboardModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule { }
