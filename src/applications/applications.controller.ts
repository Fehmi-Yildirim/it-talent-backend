import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
    StreamableFile,
    Res,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { ApplicationsService } from './applications.service'
import { CreateApplicationDto } from './dto/create-application.dto'
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto'
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UploadedCv } from './uploaded-cv.interface'

@UseGuards(JwtAuthGuard)
@Controller()
export class ApplicationsController {
    constructor(
        private readonly applicationsService: ApplicationsService,
    ) { }

    @Post('jobs/:jobId/applications')
    @UseInterceptors(
        FileInterceptor('cv', {
            limits: {
                fileSize: 10 * 1024 * 1024,
                files: 1,
            },
        }),
    )
    create(
        @Req() req: AuthenticatedRequest,
        @Param('jobId', new ParseUUIDPipe()) jobId: string,
        @Body() dto: CreateApplicationDto,
        @UploadedFile() file?: UploadedCv,
    ) {
        // CV is optional when creating an application.
        if (file) {
            this.validateCv(file)
        }

        return this.applicationsService.create(
            req.user.id,
            jobId,
            dto,
            file,
        )
    }

    @Patch('applications/:applicationId/cv')
    @UseInterceptors(
        FileInterceptor('cv', {
            limits: {
                fileSize: 10 * 1024 * 1024,
                files: 1,
            },
        }),
    )
    replaceCv(
        @Req() req: AuthenticatedRequest,
        @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
        @UploadedFile() file?: UploadedCv,
    ) {
        // CV is required when replacing an existing CV.
        this.validateCv(file)

        return this.applicationsService.replaceCv(
            req.user.id,
            applicationId,
            file,
        )
    }

    @Delete('applications/:applicationId/cv')
    deleteCv(
        @Req() req: AuthenticatedRequest,
        @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    ) {
        return this.applicationsService.deleteCv(
            req.user.id,
            applicationId,
        )
    }

    @Get('applications/:applicationId/cv')
    async downloadCv(
        @Req() req: AuthenticatedRequest,
        @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
        @Res({ passthrough: true }) response: Response,
    ) {
        const cv = await this.applicationsService.getCv(
            req.user.id,
            applicationId,
        )

        response.set({
            'Content-Type': cv.mimeType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(cv.originalName)}"`,
        })

        return new StreamableFile(cv.stream)
    }

    @Get('applications')
    findAll(@Req() req: AuthenticatedRequest) {
        return this.applicationsService.findAll(req.user.id)
    }

    @Get('applications/:applicationId')
    findOne(
        @Req() req: AuthenticatedRequest,
        @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    ) {
        return this.applicationsService.findOne(
            req.user.id,
            applicationId,
        )
    }

    @Patch('applications/:applicationId/withdraw')
    withdraw(
        @Req() req: AuthenticatedRequest,
        @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    ) {
        return this.applicationsService.withdraw(
            req.user.id,
            applicationId,
        )
    }

    @Get('recruiter/applications')
    findAllForRecruiter(@Req() req: AuthenticatedRequest) {
        return this.applicationsService.findAllForRecruiter(
            req.user.id,
        )
    }

    @Get('recruiter/applications/:applicationId')
    findOneForRecruiter(
        @Req() req: AuthenticatedRequest,
        @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    ) {
        return this.applicationsService.findOneForRecruiter(
            req.user.id,
            applicationId,
        )
    }

    @Patch('recruiter/applications/:applicationId/status')
    updateStatus(
        @Req() req: AuthenticatedRequest,
        @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
        @Body() dto: UpdateApplicationStatusDto,
    ) {
        return this.applicationsService.updateStatus(
            req.user.id,
            applicationId,
            dto.status,
        )
    }

    private validateCv(file?: UploadedCv) {
        if (!file) {
            throw new BadRequestException('CV file is required')
        }

        const extension = file.originalname
            .split('.')
            .pop()
            ?.toLowerCase()

        const allowedTypes: Record<string, string[]> = {
            pdf: ['application/pdf'],
            doc: ['application/msword'],
            docx: [
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ],
        }

        const hasValidSignature =
            (extension === 'pdf' &&
                file.buffer.subarray(0, 5).toString() === '%PDF-') ||
            (extension === 'doc' &&
                file.buffer.subarray(0, 8).toString('hex') ===
                'd0cf11e0a1b11ae1') ||
            (extension === 'docx' &&
                file.buffer.subarray(0, 2).toString() === 'PK')

        if (
            !extension ||
            !allowedTypes[extension]?.includes(file.mimetype) ||
            !hasValidSignature
        ) {
            throw new BadRequestException(
                'CV must be a PDF, DOC, or DOCX file',
            )
        }
    }
}