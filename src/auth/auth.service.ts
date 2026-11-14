
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PublicRegistrationRole } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) { }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Unable to create account');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: dto.role,
          status: 'PENDING',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      if (dto.role === PublicRegistrationRole.CANDIDATE) {
        await tx.candidate.create({
          data: { userId: createdUser.id },
        });
      } else if (dto.role === PublicRegistrationRole.RECRUITER) {
        await tx.recruiter.create({
          data: { userId: createdUser.id },
        });
      }

      return createdUser;
    });

    return {
      user,
      message:
        'Registration successful. Your account is awaiting administrator approval.',
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        isDemo: user.isDemo,
      },
      accessToken: await this.signToken(
        user.id,
        user.email,
        user.firstName,
        user.lastName,
        user.role,
      ),
    };
  }

  private signToken(
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
    role: string,
  ): Promise<string> {
    return this.jwtService.signAsync({
      sub: userId,
      email,
      firstName,
      lastName,
      role,
    });
  }
}
