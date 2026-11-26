import {
    Controller,
    Get,
    Param,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '../../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DemoReadOnlyGuard } from '../auth/guards/demo-read-only.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { MatchingService } from './matching.service';

type AuthenticatedRequest = Request & {
    user: Awaited<ReturnType<JwtStrategy['validate']>>;
};

@ApiTags('Matching')
@ApiBearerAuth('access-token')
@Controller('matches')
@UseGuards(JwtAuthGuard, RolesGuard, DemoReadOnlyGuard)
export class MatchingController {
    constructor(private readonly matchingService: MatchingService) { }

    @Get('me')
    @Roles(UserRole.CANDIDATE)
    @ApiOperation({ summary: 'Get matches for the authenticated candidate' })
    @ApiResponse({ status: 200, description: 'Candidate matches returned' })
    getMyMatches(
        @Req() req: AuthenticatedRequest,
        @Query() pagination: PaginationQueryDto,
    ) {
        return this.matchingService.getMyMatches(
            req.user.id,
            pagination.page,
            pagination.limit,
        );
    }

    @Get('me/jobs/:jobId')
    @Roles(UserRole.CANDIDATE)
    @ApiOperation({ summary: 'Get the authenticated candidate match for a job' })
    @ApiResponse({ status: 200, description: 'Candidate job match returned' })
    getMyMatchForJob(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
    ) {
        return this.matchingService.getMyMatchForJob(
            req.user.id,
            jobId,
        );
    }

    @Get('recruiter/jobs')
    @Roles(UserRole.RECRUITER)
    @ApiOperation({ summary: 'Get published jobs and match counts for the recruiter company' })
    @ApiResponse({ status: 200, description: 'Recruiter jobs and match counts returned' })
    getRecruiterJobs(@Req() req: AuthenticatedRequest) {
        return this.matchingService.getRecruiterJobs(req.user.id);
    }

    @Get('jobs/:jobId/candidates')
    @Roles(UserRole.RECRUITER)
    @ApiOperation({ summary: 'Get matching candidates for a company job' })
    @ApiResponse({ status: 200, description: 'Matching candidates returned' })
    getCandidatesForJob(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
        @Query() pagination: PaginationQueryDto,
    ) {
        return this.matchingService.getCandidatesForJob(
            req.user.id,
            jobId,
            pagination.page,
            pagination.limit,
            pagination.scoreRange,
        );
    }

}
