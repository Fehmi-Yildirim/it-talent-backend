import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobsService } from './jobs.service';
import { UpdateJobRequirementsDto } from './dto/update-job-requirements.dto';

type AuthenticatedRequest = Request & {
    user: Awaited<ReturnType<JwtStrategy['validate']>>;
};

@ApiTags('Jobs')
@ApiBearerAuth('access-token')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
    constructor(
        private readonly jobsService: JobsService,
    ) { }

    // Create a new job
    @Post()
    @ApiOperation({
        summary: 'Create a job',
        description:
            'Creates a draft job for the authenticated recruiter.',
    })
    @ApiResponse({
        status: 201,
        description: 'Job created successfully.',
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid job data.',
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication required.',
    })
    @ApiResponse({
        status: 403,
        description: 'User is not an authorized recruiter.',
    })
    create(
        @Req() req: AuthenticatedRequest,
        @Body() dto: CreateJobDto,
    ) {
        return this.jobsService.create(
            req.user.id,
            dto,
        );
    }

    // Retrieve all jobs belonging to the recruiter company
    @Get()
    @ApiOperation({
        summary: 'Get company jobs',
        description:
            'Returns all jobs belonging to the authenticated recruiter company.',
    })
    @ApiResponse({
        status: 200,
        description: 'Jobs retrieved successfully.',
    })
    @ApiResponse({
        status: 400,
        description:
            'Recruiter is not assigned to a company.',
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication required.',
    })
    @ApiResponse({
        status: 403,
        description:
            'User is not an authorized recruiter.',
    })
    getAll(@Req() req: AuthenticatedRequest) {
        return this.jobsService.getAll(req.user.id);
    }

    // Update an existing job
    @Patch(':id')
    @ApiOperation({
        summary: 'Update a job',
        description:
            'Updates a job belonging to the authenticated recruiter company.',
    })
    @ApiResponse({
        status: 200,
        description: 'Job updated successfully.',
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid job data.',
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication required.',
    })
    @ApiResponse({
        status: 403,
        description: 'User is not an authorized recruiter.',
    })
    @ApiResponse({
        status: 404,
        description: 'Job not found.',
    })
    update(
        @Req() req: AuthenticatedRequest,
        @Param('id') jobId: string,
        @Body() dto: UpdateJobDto,
    ) {
        return this.jobsService.update(
            req.user.id,
            jobId,
            dto,
        );
    }

    // Retrieve a single job by ID
    @Get(':id')
    @ApiOperation({
        summary: 'Get a job by ID',
        description:
            'Returns a job belonging to the authenticated recruiter company.',
    })
    @ApiResponse({
        status: 200,
        description: 'Job retrieved successfully.',
    })
    @ApiResponse({
        status: 400,
        description:
            'Recruiter is not assigned to a company.',
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication required.',
    })
    @ApiResponse({
        status: 403,
        description:
            'User is not an authorized recruiter.',
    })
    @ApiResponse({
        status: 404,
        description: 'Job not found.',
    })
    getById(
        @Req() req: AuthenticatedRequest,
        @Param('id') jobId: string,
    ) {
        return this.jobsService.getById(
            req.user.id,
            jobId,
        );
    }

    // Retrieve requirements for a job
    @Get(':id/requirements')
    @ApiOperation({
        summary: 'Get job requirements',
        description:
            'Returns the required and preferred skills associated with a job.',
    })
    @ApiResponse({
        status: 200,
        description: 'Job requirements retrieved successfully.',
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication required.',
    })
    @ApiResponse({
        status: 403,
        description: 'User is not an authorized recruiter.',
    })
    @ApiResponse({
        status: 404,
        description: 'Job not found.',
    })
    getRequirements(
        @Req() req: AuthenticatedRequest,
        @Param('id') jobId: string,
    ) {
        return this.jobsService.getRequirements(
            req.user.id,
            jobId,
        );
    }

    // Replace all requirements for a job
    @Patch(':id/requirements')
    @ApiOperation({
        summary: 'Update job requirements',
        description:
            'Replaces the complete set of required and preferred skills for a job.',
    })
    @ApiResponse({
        status: 200,
        description: 'Job requirements updated successfully.',
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid skill or requirement data.',
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication required.',
    })
    @ApiResponse({
        status: 403,
        description: 'User is not an authorized recruiter.',
    })
    @ApiResponse({
        status: 404,
        description: 'Job not found.',
    })
    updateRequirements(
        @Req() req: AuthenticatedRequest,
        @Param('id') jobId: string,
        @Body() dto: UpdateJobRequirementsDto,
    ) {
        return this.jobsService.updateRequirements(
            req.user.id,
            jobId,
            dto,
        );
    }

    @Delete(':id/requirements/:skillId')
    @ApiOperation({
        summary: 'Remove a job requirement',
        description:
            'Removes a required or preferred skill from a job.',
    })
    @ApiResponse({
        status: 200,
        description: 'Job requirement removed successfully.',
    })
    @ApiResponse({
        status: 401,
        description: 'Authentication required.',
    })
    @ApiResponse({
        status: 403,
        description: 'User is not an authorized recruiter.',
    })
    @ApiResponse({
        status: 404,
        description:
            'Job or job requirement not found.',
    })
    removeRequirement(
        @Req() req: AuthenticatedRequest,
        @Param('id') jobId: string,
        @Param('skillId') skillId: string,
    ) {
        return this.jobsService.removeRequirement(
            req.user.id,
            jobId,
            skillId,
        );
    }
}