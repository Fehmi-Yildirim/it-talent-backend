import {
    Body,
    Controller,
    Get,
    Patch,
    Req,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateRecruiterDto } from './dto/update-recruiter.dto';
import { RecruitersService } from './recruiters.service';

type AuthenticatedRequest = Request & {
    user: Awaited<ReturnType<JwtStrategy['validate']>>;
};

@ApiTags('Recruiters')
@ApiBearerAuth('access-token')
@Controller('recruiters')
@UseGuards(JwtAuthGuard)
export class RecruitersController {
    constructor(
        private readonly recruitersService: RecruitersService,
    ) { }

    @Get('me')
    @ApiOperation({
        summary: 'Get my recruiter profile',
        description: 'Returns the recruiter profile of the authenticated user.',
    })
    @ApiResponse({
        status: 200,
        description: 'Recruiter profile returned successfully.',
    })
    @ApiResponse({
        status: 403,
        description: 'Only recruiters can access a recruiter profile.',
    })
    @ApiResponse({
        status: 404,
        description: 'Recruiter profile not found.',
    })
    getMe(@Req() req: AuthenticatedRequest) {
        return this.recruitersService.getMe(req.user.id);
    }

    @Patch('me')
    @ApiOperation({
        summary: 'Update my recruiter profile',
        description: 'Updates the recruiter profile of the authenticated user.',
    })
    @ApiBody({
        type: UpdateRecruiterDto,
    })
    @ApiResponse({
        status: 200,
        description: 'Recruiter profile updated successfully.',
    })
    @ApiResponse({
        status: 403,
        description: 'Only recruiters can update a recruiter profile.',
    })
    @ApiResponse({
        status: 404,
        description: 'Recruiter profile not found.',
    })
    updateMe(
        @Req() req: AuthenticatedRequest,
        @Body() dto: UpdateRecruiterDto,
    ) {
        return this.recruitersService.updateMe(
            req.user.id,
            dto,
        );
    }
}