import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import type { Readable } from 'node:stream'

import { PrismaService } from '../database/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { CreateCandidateDto } from './dto/create-candidate.dto'
import { UpdateCandidateDto } from './dto/update-candidate.dto'
import { UploadedCandidateCv } from './uploaded-cv.interface'

const execFileAsync = promisify(execFile)
const PDF_MIME_TYPE = 'application/pdf'

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) { }

  async getMe(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        userId: true,
        headline: true,
        summary: true,
        location: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        availabilityDate: true,
        remotePreference: true,
        cvOriginalName: true,
        cvMimeType: true,
        cvSize: true,
        cvExpiresAt: true,
        cvRetentionConsent: true,
        cvConsentAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found')
    }

    return {
      ...candidate,
      cvUrl: this.getCvUrl(
        candidate.id,
        candidate.cvExpiresAt,
        Boolean(candidate.cvOriginalName),
      ),
    }
  }

  async create(userId: string, dto: CreateCandidateDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (user.role !== 'CANDIDATE') {
      throw new ForbiddenException(
        'Only candidates can create a candidate profile',
      )
    }

    const existingCandidate = await this.prisma.candidate.findUnique({
      where: {
        userId,
      },
    })

    if (existingCandidate) {
      throw new ConflictException('Candidate profile already exists')
    }

    return this.prisma.candidate.create({
      data: {
        userId,
        headline: dto.headline,
        summary: dto.summary,
        location: dto.location,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        currency: dto.currency,
        availabilityDate: dto.availabilityDate
          ? new Date(dto.availabilityDate)
          : undefined,
        remotePreference: dto.remotePreference,
      },
    })
  }

  async updateMe(userId: string, dto: UpdateCandidateDto) {
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        userId,
      },
    })

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found')
    }

    return this.prisma.candidate.update({
      where: {
        userId,
      },
      data: {
        headline: dto.headline,
        summary: dto.summary,
        location: dto.location,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        currency: dto.currency,
        availabilityDate: dto.availabilityDate
          ? new Date(dto.availabilityDate)
          : undefined,
        remotePreference: dto.remotePreference,
      },
    })
  }

  async uploadCv(
    userId: string,
    file: UploadedCandidateCv,
  ) {
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        userId,
      },
    })

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found')
    }

    const converted = await this.convertCvToPdf(file)
    const storedName = converted
      ? this.withPdfExtension(file.originalname)
      : file.originalname
    const storedBuffer = converted ?? file.buffer
    const storedMimeType = converted ? PDF_MIME_TYPE : file.mimetype
    const uploadDirectory = this.getUploadDirectory()

    await mkdir(uploadDirectory, {
      recursive: true,
    })

    const cvPath = join(
      'cvs',
      `${randomUUID()}${this.getFileExtension(storedName)}`,
    )

    await writeFile(
      join(this.getStorageRoot(), cvPath),
      storedBuffer,
      {
        flag: 'wx',
      },
    )

    const cvRetentionDays =
      await this.settingsService.getCvRetentionDays()

    const cvExpiresAt = new Date(
      Date.now() +
      cvRetentionDays * 24 * 60 * 60 * 1000,
    )

    const cvConsentAt = new Date()

    try {
      const updatedCandidate =
        await this.prisma.candidate.update({
          where: {
            id: candidate.id,
          },
          data: {
            cvPath,
            cvOriginalName: file.originalname,
            cvMimeType: storedMimeType,
            cvSize: storedBuffer.length,
            cvExpiresAt,
            cvRetentionConsent: true,
            cvConsentAt,
          },
          select: {
            id: true,
            userId: true,
            headline: true,
            summary: true,
            location: true,
            salaryMin: true,
            salaryMax: true,
            currency: true,
            availabilityDate: true,
            remotePreference: true,
            cvOriginalName: true,
            cvMimeType: true,
            cvSize: true,
            cvExpiresAt: true,
            cvRetentionConsent: true,
            cvConsentAt: true,
            createdAt: true,
            updatedAt: true,
          },
        })

      if (
        candidate.cvPath &&
        candidate.cvPath !== cvPath
      ) {
        await unlink(
          join(
            this.getStorageRoot(),
            candidate.cvPath,
          ),
        ).catch(() => undefined)
      }

      return {
        ...updatedCandidate,
        cvUrl: this.getCvUrl(
          updatedCandidate.id,
          updatedCandidate.cvExpiresAt,
          Boolean(updatedCandidate.cvOriginalName),
        ),
      }
    } catch (error) {
      await unlink(
        join(
          this.getStorageRoot(),
          cvPath,
        ),
      ).catch(() => undefined)

      throw error
    }
  }

  async getCv(userId: string): Promise<{
    stream: Readable
    mimeType: string
    originalName: string
  }> {
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        cvPath: true,
        cvMimeType: true,
        cvOriginalName: true,
        cvExpiresAt: true,
      },
    })

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found')
    }

    if (
      !candidate.cvPath ||
      !candidate.cvMimeType ||
      !candidate.cvOriginalName
    ) {
      throw new NotFoundException('CV not found')
    }

    if (
      candidate.cvExpiresAt &&
      candidate.cvExpiresAt <= new Date()
    ) {
      throw new NotFoundException('CV not found')
    }

    const storageRoot = this.getStorageRoot()

    const filePath = resolve(
      storageRoot,
      candidate.cvPath,
    )

    if (
      !filePath.startsWith(
        `${storageRoot}${sep}`,
      )
    ) {
      throw new InternalServerErrorException(
        'Invalid CV storage reference',
      )
    }

    return {
      stream: createReadStream(filePath),
      mimeType: candidate.cvMimeType,
      originalName: candidate.cvMimeType === PDF_MIME_TYPE
        ? this.withPdfExtension(basename(candidate.cvOriginalName))
        : basename(candidate.cvOriginalName),
    }
  }

  async deleteCv(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        cvPath: true,
      },
    })

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found')
    }

    if (!candidate.cvPath) {
      throw new NotFoundException('CV not found')
    }

    await this.prisma.candidate.update({
      where: {
        id: candidate.id,
      },
      data: {
        cvPath: null,
        cvOriginalName: null,
        cvMimeType: null,
        cvSize: null,
        cvExpiresAt: null,
        cvRetentionConsent: false,
        cvConsentAt: null,
      },
    })

    await unlink(
      join(
        this.getStorageRoot(),
        candidate.cvPath,
      ),
    ).catch(() => undefined)

    return {
      message: 'CV deleted successfully',
    }
  }

  private getCvUrl(
    candidateId: string,
    cvExpiresAt: Date | null,
    hasCv: boolean,
  ): string | null {
    if (!hasCv) {
      return null
    }

    if (
      cvExpiresAt &&
      cvExpiresAt <= new Date()
    ) {
      return null
    }

    return '/api/v1/candidates/me/cv'
  }

  private getStorageRoot(): string {
    return resolve(
      process.env.CV_UPLOAD_DIR ??
      join(process.cwd(), 'uploads'),
    )
  }

  private getUploadDirectory(): string {
    return join(
      this.getStorageRoot(),
      'cvs',
    )
  }

  private getFileExtension(
    originalName: string,
  ): string {
    const extension = originalName
      .split('.')
      .pop()
      ?.toLowerCase()

    return extension
      ? `.${extension}`
      : ''
  }

  private async convertCvToPdf(
    file: UploadedCandidateCv,
  ): Promise<Buffer | null> {
    const extension = this.getFileExtension(file.originalname).toLowerCase()
    if (extension === '.pdf') return null

    const workDirectory = await mkdtemp(join(tmpdir(), 'it-talent-cv-'))
    const inputPath = join(workDirectory, `input${extension}`)
    const outputPath = join(workDirectory, 'input.pdf')

    try {
      await writeFile(inputPath, file.buffer, { flag: 'wx' })
      const executable = process.env.LIBREOFFICE_BIN || 'soffice'
      try {
        await execFileAsync(executable, [
          `-env:UserInstallation=${pathToFileURL(join(workDirectory, 'lo-profile')).href}`,
          '--headless',
          '--convert-to',
          'pdf',
          '--outdir',
          workDirectory,
          inputPath,
        ], { timeout: 30_000, maxBuffer: 1024 * 1024 })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // LibreOffice is optional: preserve the original document if it is not installed.
          return null
        }
        throw error
      }

      const pdf = await readFile(outputPath)
      if (pdf.subarray(0, 5).toString() !== '%PDF-') {
        throw new Error('Converter did not produce a valid PDF')
      }
      if (pdf.length > 10 * 1024 * 1024) {
        throw new Error('Converted CV exceeds the maximum file size')
      }
      return pdf
    } catch {
      throw new InternalServerErrorException(
        'Unable to convert the uploaded CV to PDF',
      )
    } finally {
      await rm(workDirectory, { recursive: true, force: true })
    }
  }

  private withPdfExtension(fileName: string): string {
    return `${fileName.replace(/\.[^.]+$/, '')}.pdf`
  }
}
