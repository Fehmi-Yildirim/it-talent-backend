import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { CreateCandidateSkillDto } from './dto/create-candidate-skill.dto';
import { UpdateCandidateSkillDto } from './dto/update-candidate-skill.dto';
import { CandidateSkillsService } from './candidate-skills.service';
import { UserRole } from '../../../generated/prisma/enums';


type UserFromJwt = Awaited<ReturnType<JwtStrategy['validate']>>;

interface AuthRequest extends Request {
    user: UserFromJwt;
}

@Controller('users/me/skills')
export class CandidateSkillsController {
    constructor(
        private readonly candidateSkillsService: CandidateSkillsService,
    ) { }

    @Roles(UserRole.CANDIDATE)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get()
    findMine(@Req() req: AuthRequest) {
        return this.candidateSkillsService.findMine(req.user.id);
    }

    @Roles(UserRole.CANDIDATE)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    create(
        @Req() req: AuthRequest,
        @Body() dto: CreateCandidateSkillDto,
    ) {
        return this.candidateSkillsService.create(req.user.id, dto);
    }

    @Roles(UserRole.CANDIDATE)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':skillId')
    updateMine(
        @Req() req: AuthRequest,
        @Param('skillId') skillId: string,
        @Body() dto: UpdateCandidateSkillDto,
    ) {
        return this.candidateSkillsService.updateMine(
            req.user.id,
            skillId,
            dto,
        );
    }

    @Roles(UserRole.CANDIDATE)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete(':skillId')
    removeMine(
        @Req() req: AuthRequest,
        @Param('skillId') skillId: string,
    ) {
        return this.candidateSkillsService.removeMine(
            req.user.id,
            skillId,
        );
    }
}
