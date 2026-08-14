import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';
import { UsersService } from './users.service';

type UserFromJwt = Awaited<ReturnType<JwtStrategy['validate']>>;

interface AuthRequest extends Request {
  user: UserFromJwt;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: AuthRequest) {
    return this.usersService.getMe(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/candidate')
  createCandidateProfile(
    @Req() req: AuthRequest,
    @Body() dto: CreateCandidateProfileDto,
  ) {
    return this.usersService.createCandidateProfile(req.user.id, dto);
  }
}