import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Req,
    Res,
    StreamableFile,
    UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApplicationsService } from './applications.service'
import { CreateApplicationDto } from './dto/create-application.dto'
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto'
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller()
export class ApplicationsController {
    constructor(
        private readonly applicationsService: ApplicationsService,
    ) { }

    @Post('jobs/:jobId/applications')
    create(
        @Req() req: AuthenticatedRequest,
        @Param(
            'jobId',
            new ParseUUIDPipe(),
        )
        jobId: string,
        @Body() dto: CreateApplicationDto,
    ) {
        return this.applicationsService.create(
            req.user.id,
            jobId,
            dto,
        )
    }

    @Get('applications/:applicationId/cv')
    async downloadCv(
        @Req() req: AuthenticatedRequest,
        @Param(
            'applicationId',
            new ParseUUIDPipe(),
        )
        applicationId: string,
        @Res({ passthrough: true })
        response: Response,
    ) {
        const cv =
            await this.applicationsService.getCv(
                req.user.id,
                applicationId,
            )

        response.set({
            'Content-Type': cv.mimeType,
            'Content-Disposition': `inline; filename="${encodeURIComponent(
                cv.originalName,
            )}"`,
        })

        return new StreamableFile(
            cv.stream,
        )
    }

    @Get('applications')
    findAll(
        @Req() req: AuthenticatedRequest,
    ) {
        return this.applicationsService.findAll(
            req.user.id,
        )
    }

    @Get('applications/:applicationId')
    findOne(
        @Req() req: AuthenticatedRequest,
        @Param(
            'applicationId',
            new ParseUUIDPipe(),
        )
        applicationId: string,
    ) {
        return this.applicationsService.findOne(
            req.user.id,
            applicationId,
        )
    }

    @Patch('applications/:applicationId/withdraw')
    withdraw(
        @Req() req: AuthenticatedRequest,
        @Param(
            'applicationId',
            new ParseUUIDPipe(),
        )
        applicationId: string,
    ) {
        return this.applicationsService.withdraw(
            req.user.id,
            applicationId,
        )
    }

    @Get('recruiter/applications')
    findAllForRecruiter(
        @Req() req: AuthenticatedRequest,
    ) {
        return this.applicationsService.findAllForRecruiter(
            req.user.id,
        )
    }

    @Get('recruiter/applications/:applicationId')
    findOneForRecruiter(
        @Req() req: AuthenticatedRequest,
        @Param(
            'applicationId',
            new ParseUUIDPipe(),
        )
        applicationId: string,
    ) {
        return this.applicationsService.findOneForRecruiter(
            req.user.id,
            applicationId,
        )
    }

    @Patch(
        'recruiter/applications/:applicationId/status',
    )
    updateStatus(
        @Req() req: AuthenticatedRequest,
        @Param(
            'applicationId',
            new ParseUUIDPipe(),
        )
        applicationId: string,
        @Body() dto: UpdateApplicationStatusDto,
    ) {
        return this.applicationsService.updateStatus(
            req.user.id,
            applicationId,
            dto.status,
        )
    }
}