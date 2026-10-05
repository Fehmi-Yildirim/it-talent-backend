import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { createReadStream } from 'node:fs'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Readable } from 'node:stream'

import { PrismaService } from '../database/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { CreateCandidateDto } from './dto/create-candidate.dto'
import { UpdateCandidateDto } from './dto/update-candidate.dto'
import { UploadedCandidateCv } from './uploaded-cv.interface'

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
      cvUrl: this.getCvUrl(candidate.id, candidate.cvExpiresAt),
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

    const uploadDirectory = this.getUploadDirectory()

    await mkdir(uploadDirectory, { recursive: true })

    const cvPath = join(
      'cvs',
      `${randomUUID()}${this.getFileExtension(file.originalname)}`,
    )

    await writeFile(
      join(this.getStorageRoot(), cvPath),
      file.buffer,
      {
        flag: 'wx',
      },
    )

    const cvRetentionDays =
      await this.settingsService.getCvRetentionDays()

    const cvExpiresAt = new Date(
      Date.now() + cvRetentionDays * 24 * 60 * 60 * 1000,
    )

    const cvConsentAt = new Date()

    try {
      const updatedCandidate = await this.prisma.candidate.update({
        where: {
          id: candidate.id,
        },
        data: {
          cvPath,
          cvOriginalName: file.originalname,
          cvMimeType: file.mimetype,
          cvSize: file.size,
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

      if (candidate.cvPath && candidate.cvPath !== cvPath) {
        await unlink(
          join(this.getStorageRoot(), candidate.cvPath),
        ).catch(() => undefined)
      }

      return {
        ...updatedCandidate,
        cvUrl: this.getCvUrl(
          updatedCandidate.id,
          updatedCandidate.cvExpiresAt,
        ),
      }
    } catch (error) {
      await unlink(
        join(this.getStorageRoot(), cvPath),
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

    if (!filePath.startsWith(`${storageRoot}${sep}`)) {
      throw new InternalServerErrorException(
        'Invalid CV storage reference',
      )
    }

    return {
      stream: createReadStream(filePath),
      mimeType: candidate.cvMimeType,
      originalName: basename(candidate.cvOriginalName),
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
      join(this.getStorageRoot(), candidate.cvPath),
    ).catch(() => undefined)

    return {
      message: 'CV deleted successfully',
    }
  }

  private getCvUrl(
    candidateId: string,
    cvExpiresAt: Date | null,
  ): string | null {
    if (
      cvExpiresAt &&
      cvExpiresAt <= new Date()
    ) {
      return null
    }

    return `/api/v1/candidates/me/cv`
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

    return extension ? `.${extension}` : ''
  }
}
