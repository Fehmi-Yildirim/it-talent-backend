import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateJobRequirementsDto } from './dto/update-job-requirements.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateJobRequirementDto } from './dto/create-job-requirement.dto';
import { UpdateJobRequirementDto } from './dto/update-job-requirement.dto';
import { GetJobsQueryDto } from './dto/get-jobs-query.dto';
import { JobDiscoveryResponseDto } from './dto/job-discovery-response.dto';
import { JobDetailResponseDto } from './dto/job-detail-response.dto';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@ApiTags('Jobs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
    constructor(private readonly jobsService: JobsService) { }

    @Post()
    async create(
        @Req() req: AuthenticatedRequest,
        @Body() dto: CreateJobDto,
    ) {
        return this.jobsService.create(req.user.id, dto);
    }

    @Get()
    @ApiOperation({
        summary: 'Discover available jobs',
        description:
            'Returns currently available published jobs for candidates. Supports text search, filters, sorting, and pagination.',
    })
    @ApiOkResponse({
        description:
            'Paginated list of currently available published jobs.',
        type: JobDiscoveryResponseDto,
    })
    async getAll(
        @Req() req: AuthenticatedRequest,
        @Query() query: GetJobsQueryDto,
    ) {
        if (req.user.role === 'RECRUITER') {
            return this.jobsService.getAll(req.user.id);
        }

        return this.jobsService.discover(query);
    }

    @Get(':jobId')
    @ApiOperation({
        summary: 'Get a job for candidate discovery',
        description:
            'Returns a currently available published job with company information and required/preferred skills. Draft, paused, closed, archived, and expired jobs are not exposed.',
    })
    @ApiOkResponse({
        description: 'Currently available published job.',
        type: JobDetailResponseDto,
    })
    async getById(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
    ) {
        if (req.user.role === 'RECRUITER') {
            return this.jobsService.getById(req.user.id, jobId);
        }

        return this.jobsService.getPublicById(jobId);
    }

    @Patch(':jobId')
    async update(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
        @Body() dto: UpdateJobDto,
    ) {
        return this.jobsService.update(req.user.id, jobId, dto);
    }

    @Post(':jobId/publish')
    async publish(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
    ) {
        return this.jobsService.publish(req.user.id, jobId);
    }

    @Post(':jobId/pause')
    async pause(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
    ) {
        return this.jobsService.pause(req.user.id, jobId);
    }

    @Post(':jobId/resume')
    async resume(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
    ) {
        return this.jobsService.resume(req.user.id, jobId);
    }

    @Post(':jobId/close')
    async close(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
    ) {
        return this.jobsService.close(req.user.id, jobId);
    }

    @Post(':jobId/reopen')
    async reopen(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
    ) {
        return this.jobsService.reopen(req.user.id, jobId);
    }

    @Get(':jobId/requirements')
    async getRequirements(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
    ) {
        return this.jobsService.getRequirements(req.user.id, jobId);
    }

    @Patch(':jobId/requirements')
    async updateRequirements(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
        @Body() dto: UpdateJobRequirementsDto,
    ) {
        return this.jobsService.updateRequirements(
            req.user.id,
            jobId,
            dto,
        );
    }

    @Delete(':jobId/requirements/:skillId')
    async removeRequirement(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
        @Param('skillId') skillId: string,
    ) {
        return this.jobsService.removeRequirement(
            req.user.id,
            jobId,
            skillId,
        );
    }

    @Post(':jobId/requirements')
    async createRequirement(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
        @Body() dto: CreateJobRequirementDto,
    ) {
        return this.jobsService.createRequirement(
            req.user.id,
            jobId,
            dto,
        );
    }

    @Patch(':jobId/requirements/:requirementId')
    async updateRequirement(
        @Req() req: AuthenticatedRequest,
        @Param('jobId') jobId: string,
        @Param('requirementId') requirementId: string,
        @Body() dto: UpdateJobRequirementDto,
    ) {
        return this.jobsService.updateRequirement(
            req.user.id,
            jobId,
            requirementId,
            dto,
        );
    }
}