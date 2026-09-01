
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
import { ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateJobRequirementsDto } from './dto/update-job-requirements.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateJobRequirementDto } from './dto/create-job-requirement.dto';
import { UpdateJobRequirementDto } from './dto/update-job-requirement.dto';

@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
    constructor(
        private readonly jobsService: JobsService,
    ) { }

    // Create job
    @Post()
    async create(
        @Req() req: any,
        @Body() dto: CreateJobDto,
    ) {
        return this.jobsService.create(
            req.user.id,
            dto,
        );
    }

    // Get all jobs
    @Get()
    async getAll(
        @Req() req: any,
    ) {
        return this.jobsService.getAll(
            req.user.id,
        );
    }

    // Get job by ID
    @Get(':jobId')
    async getById(
        @Req() req: any,
        @Param('jobId') jobId: string,
    ) {
        return this.jobsService.getById(
            req.user.id,
            jobId,
        );
    }

    // Update job
    @Patch(':jobId')
    async update(
        @Req() req: any,
        @Param('jobId') jobId: string,
        @Body() dto: UpdateJobDto,
    ) {
        return this.jobsService.update(
            req.user.id,
            jobId,
            dto,
        );
    }

    // Publish job
    @Post(':jobId/publish')
    async publish(
        @Req() req: any,
        @Param('jobId') jobId: string,
    ) {
        return this.jobsService.publish(
            req.user.id,
            jobId,
        );
    }

    // Close job
    @Post(':jobId/close')
    async close(
        @Req() req: any,
        @Param('jobId') jobId: string,
    ) {
        return this.jobsService.close(
            req.user.id,
            jobId,
        );
    }

    // Get job requirements
    @Get(':jobId/requirements')
    async getRequirements(
        @Req() req: any,
        @Param('jobId') jobId: string,
    ) {
        return this.jobsService.getRequirements(
            req.user.id,
            jobId,
        );
    }

    // Replace all job requirements
    @Patch(':jobId/requirements')
    async updateRequirements(
        @Req() req: any,
        @Param('jobId') jobId: string,
        @Body() dto: UpdateJobRequirementsDto,
    ) {
        return this.jobsService.updateRequirements(
            req.user.id,
            jobId,
            dto,
        );
    }

    // Remove one job requirement
    @Delete(':jobId/requirements/:skillId')
    async removeRequirement(
        @Req() req: any,
        @Param('jobId') jobId: string,
        @Param('skillId') skillId: string,
    ) {
        return this.jobsService.removeRequirement(
            req.user.id,
            jobId,
            skillId,
        );
    }


    // Add one job requirement
    @Post(':jobId/requirements')
    async createRequirement(
        @Req() req: any,
        @Param('jobId') jobId: string,
        @Body() dto: CreateJobRequirementDto,
    ) {
        return this.jobsService.createRequirement(
            req.user.id,
            jobId,
            dto,
        );
    }

    // Update one job requirement
    @Patch(':jobId/requirements/:requirementId')
    async updateRequirement(
        @Req() req: any,
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
