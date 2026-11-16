import { IsIn, IsString } from 'class-validator';

export const DEMO_LOGIN_ROLES = ['CANDIDATE', 'RECRUITER'] as const;

export type DemoLoginRole = (typeof DEMO_LOGIN_ROLES)[number];

export class DemoLoginDto {
    @IsString()
    @IsIn(DEMO_LOGIN_ROLES)
    role: DemoLoginRole;
}