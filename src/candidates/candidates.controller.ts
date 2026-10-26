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
import * as yauzl from 'yauzl'
import { UserRole } from '../../generated/prisma/enums'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtStrategy } from '../auth/strategies/jwt.strategy'
import { CreateCandidateDto } from './dto/create-candidate.dto'
import { UpdateCandidateDto } from './dto/update-candidate.dto'
import { UploadedCandidateCv } from './uploaded-cv.interface'
import { CandidatesService } from './candidates.service'
import { CvUploadInterceptor } from './cv-upload.interceptor'

type AuthenticatedRequest = Request & {
  user: Awaited<ReturnType<JwtStrategy['validate']>>
}

function openZip(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      {
        lazyEntries: true,
        validateEntrySizes: true,
      },
      (error, zipFile) => {
        if (error) {
          reject(error)
          return
        }

        if (!zipFile) {
          reject(new Error('Unable to open ZIP archive'))
          return
        }

        resolve(zipFile)
      },
    )
  })
}

async function isValidDocx(buffer: Buffer): Promise<boolean> {
  try {
    const zip = await openZip(buffer)

    return await new Promise<boolean>((resolve) => {
      const requiredEntries = new Set([
        '[Content_Types].xml',
        '_rels/.rels',
        'word/document.xml',
      ])

      let entryCount = 0
      let totalUncompressedSize = 0
      let finished = false

      const finish = (valid: boolean) => {
        if (finished) return
        finished = true
        zip.close()
        resolve(valid)
      }

      zip.on('error', () => finish(false))

      zip.on('entry', (entry: yauzl.Entry) => {
        entryCount += 1
        totalUncompressedSize += entry.uncompressedSize

        if (
          entryCount > 1000 ||
          totalUncompressedSize > 20 * 1024 * 1024 ||
          entry.fileName.startsWith('/') ||
          entry.fileName.split('/').includes('..')
        ) {
          finish(false)
          return
        }

        requiredEntries.delete(entry.fileName)
        zip.readEntry()
      })

      zip.on('end', () => {
        finish(requiredEntries.size === 0)
      })

      zip.readEntry()
    })
  } catch {
    return false
  }
}

@ApiTags('Candidates')
@ApiBearerAuth('access-token')
@Controller('candidates')
@Roles(UserRole.CANDIDATE)
@UseGuards(JwtAuthGuard, RolesGuard)
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
  ) { }

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
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCandidateDto,
  ) {
    return this.candidatesService.create(
      req.user.id,
      dto,
    )
  }

  @Post('me/cv')
  @UseInterceptors(CvUploadInterceptor())

  async uploadCv(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: UploadedCandidateCv,
  ) {
    if (!file) {
      throw new BadRequestException(
        'CV file is required',
      )
    }

    const originalName = file.originalname
    const lastDotIndex = originalName.lastIndexOf('.')

    const extension =
      lastDotIndex > 0 && lastDotIndex < originalName.length - 1
        ? originalName.slice(lastDotIndex + 1).toLowerCase()
        : undefined

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
      (extension === 'docx' && (await isValidDocx(file.buffer)))

    if (
      !extension ||
      !allowedTypes[extension]?.includes(
        file.mimetype,
      ) ||
      !hasValidSignature
    ) {
      throw new BadRequestException(
        'CV must be a PDF, DOC, or DOCX file',
      )
    }

    return this.candidatesService.uploadCv(
      req.user.id,
      file,
    )
  }

  @Get('me/cv')
  async getCv(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cv = await this.candidatesService.getCv(
      req.user.id,
    )


    response.set({
      'Content-Type': cv.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        cv.originalName,
      )}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    })


    return new StreamableFile(cv.stream)
  }

  @Delete('me/cv')
  @ApiOperation({
    summary: 'Delete my CV',
    description:
      'Deletes the current CV belonging to the authenticated candidate.',
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
    return this.candidatesService.deleteCv(
      req.user.id,
    )
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
  updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateCandidateDto,
  ) {
    return this.candidatesService.updateMe(
      req.user.id,
      dto,
    )
  }
}
