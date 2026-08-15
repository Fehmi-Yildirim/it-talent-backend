import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { CreateCandidateSkillDto } from './dto/create-candidate-skill.dto';
import { UpdateCandidateSkillDto } from './dto/update-candidate-skill.dto';
import { CandidateSkillsService } from './candidate-skills.service';


type UserFromJwt = Awaited<ReturnType<JwtStrategy['validate']>>;

interface AuthRequest extends Request {
    user: UserFromJwt;
}

@Controller('users/me/skills')
export class CandidateSkillsController {
    constructor(
        private readonly candidateSkillsService: CandidateSkillsService,
    ) { }

    @UseGuards(JwtAuthGuard)
    @Get()
    findMine(@Req() req: AuthRequest) {
        return this.candidateSkillsService.findMine(req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    create(
        @Req() req: AuthRequest,
        @Body() dto: CreateCandidateSkillDto,
    ) {
        return this.candidateSkillsService.create(req.user.id, dto);
    }

    @UseGuards(JwtAuthGuard)
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

    @UseGuards(JwtAuthGuard)
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