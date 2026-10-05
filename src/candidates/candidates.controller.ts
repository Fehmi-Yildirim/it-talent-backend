import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { UserRole } from '../../generated/prisma/enums'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtStrategy } from '../auth/strategies/jwt.strategy'
import { CreateCandidateDto } from './dto/create-candidate.dto'
import { UpdateCandidateDto } from './dto/update-candidate.dto'
import { UploadedCandidateCv } from './uploaded-cv.interface'
import { CandidatesService } from './candidates.service'

type AuthenticatedRequest = Request & {
  user: Awaited<ReturnType<JwtStrategy['validate']>>
}

@ApiTags('Candidates')
@ApiBearerAuth('access-token')
@Controller('candidates')
@Roles(UserRole.CANDIDATE)
@UseGuards(JwtAuthGuard, RolesGuard)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) { }

  @Get('me')
  @ApiOperation({
    summary: 'Get my candidate profile',
    description:
      'Returns the candidate profile belonging to the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Candidate profile returned successfully.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only candidates can access a candidate profile.',
  })
  @ApiNotFoundResponse({
    description: 'Candidate profile not found.',
  })
  getMe(@Req() req: AuthenticatedRequest) {
    return this.candidatesService.getMe(req.user.id)
  }

  @Post()
  @ApiOperation({
    summary: 'Create my candidate profile',
    description:
      'Creates a candidate profile for the authenticated user. Ownership is derived server-side from the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Candidate profile created successfully.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only candidates can create a candidate profile.',
  })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCandidateDto) {
    return this.candidatesService.create(req.user.id, dto)
  }

  @Post('me/cv')
  @UseInterceptors(
    FileInterceptor('cv', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  uploadCv(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: UploadedCandidateCv,
  ) {
    if (!file) {
      throw new BadRequestException('CV file is required')
    }

    const extension = file.originalname.split('.').pop()?.toLowerCase()

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

    return this.candidatesService.uploadCv(req.user.id, file)
  }

  @Get('me/cv')
  async getCv(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cv = await this.candidatesService.getCv(req.user.id)

    response.set({
      'Content-Type': cv.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(
        cv.originalName,
      )}"`,
    })

    return new StreamableFile(cv.stream)
  }

  @Delete('me/cv')
  @ApiOperation({
    summary: 'Delete my CV',
    description:
      'Deletes the CV belonging to the authenticated candidate.',
  })
  @ApiOkResponse({
    description: 'CV deleted successfully.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only candidates can delete a candidate CV.',
  })
  @ApiNotFoundResponse({
    description: 'Candidate profile or CV not found.',
  })
  deleteCv(@Req() req: AuthenticatedRequest) {
    return this.candidatesService.deleteCv(req.user.id)
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update my candidate profile',
    description:
      'Updates the candidate profile belonging to the authenticated user. Ownership is derived server-side from the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Candidate profile updated successfully.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only candidates can update a candidate profile.',
  })
  @ApiNotFoundResponse({
    description: 'Candidate profile not found.',
  })
  updateMe(@Req() req: AuthenticatedRequest, @Body() dto: UpdateCandidateDto) {
    return this.candidatesService.updateMe(req.user.id, dto)
  }
}
