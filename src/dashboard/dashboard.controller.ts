import {
    Controller,
    Get,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '../../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';

interface AuthenticatedRequest extends Request {
    user: {
        id: string;
    };
}

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('candidates/me/dashboard')
    @Roles(UserRole.CANDIDATE)
    @ApiOperation({
        summary: 'Get candidate dashboard',
        description:
            'Returns dashboard data for the authenticated candidate.',
    })
    @ApiResponse({
        status: 200,
        description: 'Candidate dashboard returned successfully.',
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication is required.',
    })
    @ApiResponse({
        status: 403,
        description: 'Only candidates can access this endpoint.',
    })
    getCandidateDashboard(@Req() req: AuthenticatedRequest) {
        return this.dashboardService.getCandidateDashboard(req.user.id);
    }

    @Get('recruiters/me/dashboard')
    @Roles(UserRole.RECRUITER)
    @ApiOperation({
        summary: 'Get recruiter dashboard',
        description:
            'Returns dashboard data for the authenticated recruiter.',
    })
    @ApiResponse({
        status: 200,
        description: 'Recruiter dashboard returned successfully.',
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication is required.',
    })
    @ApiResponse({
        status: 403,
        description: 'Only recruiters can access this endpoint.',
    })
    getRecruiterDashboard(@Req() req: AuthenticatedRequest) {
        return this.dashboardService.getRecruiterDashboard(req.user.id);
    }
}