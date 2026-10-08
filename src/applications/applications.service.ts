import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    InternalServerErrorException,
} from '@nestjs/common'
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    unlink,
    writeFile,
} from 'node:fs/promises'
import { promisify } from 'node:util'
import {
    basename,
    extname,
    join,
    resolve,
    sep,
} from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { ApplicationStatus, JobStatus } from '../../generated/prisma/enums'
import { PrismaService } from '../database/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { CreateApplicationDto } from './dto/create-application.dto'
import { UploadedCv } from './uploaded-cv.interface'

const execFileAsync = promisify(execFile)

@Injectable()
export class ApplicationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly settingsService: SettingsService,
    ) { }

    async create(
        candidateUserId: string,
        jobId: string,
        dto: CreateApplicationDto,
        file?: UploadedCv,
    ) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
        })

        if (!candidate) {
            throw new ForbiddenException('Only candidates can apply for jobs')
        }

        const job = await this.prisma.job.findUnique({
            where: {
                id: jobId,
            },
            select: {
                id: true,
                status: true,
                expiresAt: true,
            },
        })

        if (!job) {
            throw new NotFoundException('Job not found')
        }

        if (job.status !== JobStatus.PUBLISHED) {
            throw new ConflictException(
                'This job is not available for applications',
            )
        }

        if (job.expiresAt && job.expiresAt <= new Date()) {
            throw new ConflictException('This job has expired')
        }

        const existingApplication = await this.prisma.application.findUnique({
            where: {
                candidateId_jobId: {
                    candidateId: candidate.id,
                    jobId: job.id,
                },
            },
        })

        if (
            existingApplication &&
            existingApplication.status !== ApplicationStatus.WITHDRAWN
        ) {
            throw new ConflictException('You have already applied for this job')
        }

        const storedCv = file
            ? await this.prepareCvForStorage(file)
            : undefined

        let cvPath: string | undefined

        if (storedCv) {
            const uploadDirectory = this.getUploadDirectory()

            await mkdir(uploadDirectory, { recursive: true })

            cvPath = join(
                'cvs',
                `${randomUUID()}${this.getFileExtension(storedCv.originalname)}`,
            )

            await writeFile(
                join(this.getStorageRoot(), cvPath),
                storedCv.buffer,
                {
                    flag: 'wx',
                },
            )
        }

        const cvRetentionDays = file
            ? await this.settingsService.getCvRetentionDays()
            : null

        const cvExpiresAt = file
            ? new Date(
                Date.now() +
                cvRetentionDays * 24 * 60 * 60 * 1000,
            )
            : null

        const cvConsentAt =
            file && dto.cvRetentionConsent === true ? new Date() : null

        try {
            if (existingApplication) {
                const updatedApplication =
                    await this.prisma.application.update({
                        where: {
                            id: existingApplication.id,
                        },
                        data: {
                            coverLetter: dto.coverLetter,
                            status: ApplicationStatus.PENDING,

                            cvPath: cvPath ?? null,
                            cvOriginalName: storedCv?.originalname ?? null,
                            cvMimeType: storedCv?.mimetype ?? null,
                            cvSize: storedCv?.size ?? null,

                            cvExpiresAt,
                            cvRetentionConsent:
                                dto.cvRetentionConsent ?? false,
                            cvConsentAt,
                        },
                    })

                if (
                    existingApplication.cvPath &&
                    existingApplication.cvPath !== cvPath
                ) {
                    await unlink(
                        join(
                            this.getStorageRoot(),
                            existingApplication.cvPath,
                        ),
                    ).catch(() => undefined)
                }

                return this.withCvUrl(updatedApplication)
            }

            const application = await this.prisma.application.create({
                data: {
                    candidateId: candidate.id,
                    jobId: job.id,
                    coverLetter: dto.coverLetter,
                    status: ApplicationStatus.PENDING,

                    cvPath,
                    cvOriginalName: file?.originalname,
                    cvMimeType: file?.mimetype,
                    cvSize: file?.size,

                    cvExpiresAt,
                    cvRetentionConsent: dto.cvRetentionConsent ?? false,
                    cvConsentAt,
                },
            })

            return this.withCvUrl(application)
        } catch (error) {
            if (cvPath) {
                await unlink(
                    join(this.getStorageRoot(), cvPath),
                ).catch(() => undefined)
            }

            throw error
        }
    }

    async replaceCv(
        candidateUserId: string,
        applicationId: string,
        file?: UploadedCv,
    ) {
        if (!file) {
            throw new BadRequestException('CV file is required')
        }

        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
        })

        if (!candidate) {
            throw new ForbiddenException(
                'Only candidates can replace CVs',
            )
        }

        const application = await this.prisma.application.findUnique({
            where: {
                id: applicationId,
            },
        })

        if (!application) {
            throw new NotFoundException('Application not found')
        }

        if (application.candidateId !== candidate.id) {
            throw new ForbiddenException(
                'You are not allowed to modify this application',
            )
        }

        const storedCv = await this.prepareCvForStorage(file)

        const uploadDirectory = this.getUploadDirectory()

        await mkdir(uploadDirectory, { recursive: true })

        const newCvPath = join(
            'cvs',
            `${randomUUID()}${this.getFileExtension(storedCv.originalname)}`,
        )

        const newFilePath = join(
            this.getStorageRoot(),
            newCvPath,
        )

        await writeFile(newFilePath, storedCv.buffer, {
            flag: 'wx',
        })

        try {
            const cvRetentionDays =
                await this.settingsService.getCvRetentionDays()

            const cvExpiresAt = new Date(
                Date.now() +
                cvRetentionDays * 24 * 60 * 60 * 1000,
            )

            const updatedApplication =
                await this.prisma.application.update({
                    where: {
                        id: application.id,
                    },
                    data: {
                        cvPath: newCvPath,
                        cvOriginalName: storedCv.originalname,
                        cvMimeType: storedCv.mimetype,
                        cvSize: storedCv.size,
                        cvExpiresAt,
                    },
                })

            if (application.cvPath) {
                await unlink(
                    join(
                        this.getStorageRoot(),
                        application.cvPath,
                    ),
                ).catch(() => undefined)
            }

            return this.withCvUrl(updatedApplication)
        } catch (error) {
            await unlink(newFilePath).catch(() => undefined)

            throw error
        }
    }

    async deleteCv(
        candidateUserId: string,
        applicationId: string,
    ) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
        })

        if (!candidate) {
            throw new ForbiddenException(
                'Only candidates can delete CVs',
            )
        }

        const application = await this.prisma.application.findUnique({
            where: {
                id: applicationId,
            },
        })

        if (!application) {
            throw new NotFoundException('Application not found')
        }

        if (application.candidateId !== candidate.id) {
            throw new ForbiddenException(
                'You are not allowed to modify this application',
            )
        }

        const updatedApplication =
            await this.prisma.application.update({
                where: {
                    id: application.id,
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

        if (application.cvPath) {
            await unlink(
                join(
                    this.getStorageRoot(),
                    application.cvPath,
                ),
            ).catch(() => undefined)
        }

        return this.withCvUrl(updatedApplication)
    }

    async findAll(candidateUserId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
        })

        if (!candidate) {
            throw new ForbiddenException(
                'Only candidates can view applications',
            )
        }

        const applications = await this.prisma.application.findMany({
            where: {
                candidateId: candidate.id,
            },
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        location: true,
                        employmentType: true,
                        workMode: true,
                        company: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        return applications.map((application) =>
            this.withCvUrl(application),
        )
    }

    async findOne(candidateUserId: string, applicationId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
        })

        if (!candidate) {
            throw new ForbiddenException(
                'Only candidates can view applications',
            )
        }

        const application = await this.prisma.application.findUnique({
            where: {
                id: applicationId,
            },
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        location: true,
                        employmentType: true,
                        workMode: true,
                        company: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
            },
        })

        if (!application) {
            throw new NotFoundException('Application not found')
        }

        if (application.candidateId !== candidate.id) {
            throw new ForbiddenException(
                'You are not allowed to view this application',
            )
        }

        return this.withCvUrl(application)
    }

    async withdraw(candidateUserId: string, applicationId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
        })

        if (!candidate) {
            throw new ForbiddenException(
                'Only candidates can withdraw applications',
            )
        }

        const application = await this.prisma.application.findUnique({
            where: {
                id: applicationId,
            },
        })

        if (!application) {
            throw new NotFoundException('Application not found')
        }

        if (application.candidateId !== candidate.id) {
            throw new ForbiddenException(
                'You are not allowed to withdraw this application',
            )
        }

        if (
            application.status !== ApplicationStatus.PENDING &&
            application.status !== ApplicationStatus.REVIEWING
        ) {
            throw new ConflictException('This application cannot be withdrawn')
        }

        const updatedApplication = await this.prisma.application.update({
            where: {
                id: application.id,
            },
            data: {
                status: ApplicationStatus.WITHDRAWN,
            },
        })

        return this.withCvUrl(updatedApplication)
    }

    async findAllForRecruiter(recruiterUserId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId: recruiterUserId,
            },
            select: {
                id: true,
                companyId: true,
            },
        })

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can view applications',
            )
        }

        if (!recruiter.companyId) {
            throw new ForbiddenException(
                'Recruiter is not associated with a company',
            )
        }

        const applications = await this.prisma.application.findMany({
            where: {
                job: {
                    companyId: recruiter.companyId,
                },
            },
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        company: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
                candidate: {
                    select: {
                        id: true,
                        headline: true,
                        summary: true,
                        location: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        return applications.map((application) =>
            this.withCvUrl(application),
        )
    }

    async findOneForRecruiter(
        recruiterUserId: string,
        applicationId: string,
    ) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId: recruiterUserId,
            },
            select: {
                id: true,
                companyId: true,
            },
        })

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can view applications',
            )
        }

        if (!recruiter.companyId) {
            throw new ForbiddenException(
                'Recruiter is not associated with a company',
            )
        }

        const application = await this.prisma.application.findUnique({
            where: {
                id: applicationId,
            },
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        companyId: true,
                        company: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
                candidate: {
                    select: {
                        id: true,
                        headline: true,
                        summary: true,
                        location: true,
                    },
                },
            },
        })

        if (!application) {
            throw new NotFoundException('Application not found')
        }

        if (application.job.companyId !== recruiter.companyId) {
            throw new ForbiddenException(
                'You are not allowed to view this application',
            )
        }

        return this.withCvUrl(application)
    }

    async getCv(
        userId: string,
        applicationId: string,
    ): Promise<{
        stream: Readable
        mimeType: string
        originalName: string
    }> {
        const application = await this.prisma.application.findUnique({
            where: {
                id: applicationId,
            },
            include: {
                job: {
                    select: {
                        companyId: true,
                    },
                },
            },
        })

        if (!application) {
            throw new NotFoundException('Application not found')
        }

        if (
            !application.cvPath ||
            !application.cvMimeType ||
            !application.cvOriginalName
        ) {
            throw new NotFoundException('CV not found')
        }

        const [candidate, recruiter] = await Promise.all([
            this.prisma.candidate.findUnique({
                where: {
                    userId,
                },
                select: {
                    id: true,
                },
            }),
            this.prisma.recruiter.findUnique({
                where: {
                    userId,
                },
                select: {
                    companyId: true,
                },
            }),
        ])

        const canAccess =
            candidate?.id === application.candidateId ||
            recruiter?.companyId === application.job.companyId

        if (!canAccess) {
            throw new ForbiddenException(
                'You are not allowed to access this CV',
            )
        }

        if (
            application.cvExpiresAt &&
            application.cvExpiresAt <= new Date()
        ) {
            throw new NotFoundException('CV not found')
        }

        const storageRoot = this.getStorageRoot()
        const filePath = resolve(storageRoot, application.cvPath)

        if (!filePath.startsWith(`${storageRoot}${sep}`)) {
            throw new InternalServerErrorException(
                'Invalid CV storage reference',
            )
        }

        return {
            stream: createReadStream(filePath),
            mimeType: application.cvMimeType,
            originalName: basename(application.cvOriginalName),
        }
    }

    private async prepareCvForStorage(
        file: UploadedCv,
    ): Promise<UploadedCv> {
        const extension = extname(file.originalname).toLowerCase()

        if (extension !== '.doc' && extension !== '.docx') {
            return file
        }

        const conversionDirectory = await mkdtemp(
            join(tmpdir(), 'it-talent-cv-'),
        )

        const inputFileName = `${randomUUID()}${extension}`
        const inputPath = join(
            conversionDirectory,
            inputFileName,
        )

        const profileDirectory = join(
            conversionDirectory,
            'profile',
        )

        await mkdir(profileDirectory, { recursive: true })

        try {
            await writeFile(inputPath, file.buffer)

            const sofficeCommand =
                process.env.LIBREOFFICE_PATH ??
                (process.platform === 'win32'
                    ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
                    : 'soffice')

            await execFileAsync(
                sofficeCommand,
                [
                    '--headless',
                    `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`,
                    '--convert-to',
                    'pdf:writer_pdf_Export',
                    '--outdir',
                    conversionDirectory,
                    inputPath,
                ],
                {
                    timeout: 30_000,
                    maxBuffer: 1024 * 1024,
                },
            )

            const pdfPath = join(
                conversionDirectory,
                `${basename(inputFileName, extension)}.pdf`,
            )

            const pdfBuffer = await readFile(pdfPath)

            const pdfName = `${basename(
                file.originalname,
                extname(file.originalname),
            )}.pdf`

            return {
                buffer: pdfBuffer,
                originalname: pdfName,
                mimetype: 'application/pdf',
                size: pdfBuffer.length,
            }
        } catch {
            throw new InternalServerErrorException(
                'Unable to convert CV to PDF',
            )
        } finally {
            await rm(conversionDirectory, {
                recursive: true,
                force: true,
            }).catch(() => undefined)
        }
    }

    private getStorageRoot(): string {
        return resolve(
            process.env.CV_UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
        )
    }

    private getUploadDirectory(): string {
        return join(this.getStorageRoot(), 'cvs')
    }

    private getFileExtension(originalName: string): string {
        const extension = originalName.split('.').pop()?.toLowerCase()

        return extension ? `.${extension}` : ''
    }

    private withCvUrl<
        T extends {
            id: string
            cvPath?: string | null
            cvExpiresAt?: Date | null
        },
    >(application: T) {
        const { cvPath, ...data } = application

        const cvIsAvailable =
            !!cvPath &&
            (!application.cvExpiresAt ||
                application.cvExpiresAt > new Date())

        return {
            ...data,
            cvUrl: cvIsAvailable
                ? `/api/v1/applications/${application.id}/cv`
                : null,
        }
    }

    async updateStatus(
        recruiterUserId: string,
        applicationId: string,
        status: ApplicationStatus,
    ) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId: recruiterUserId,
            },
            select: {
                companyId: true,
            },
        })

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can manage applications',
            )
        }

        if (!recruiter.companyId) {
            throw new ForbiddenException(
                'Recruiter is not associated with a company',
            )
        }

        const application = await this.prisma.application.findUnique({
            where: {
                id: applicationId,
            },
            include: {
                job: {
                    select: {
                        companyId: true,
                    },
                },
            },
        })

        if (!application) {
            throw new NotFoundException('Application not found')
        }

        if (application.job.companyId !== recruiter.companyId) {
            throw new ForbiddenException(
                'You are not allowed to manage this application',
            )
        }

        if (!this.isValidStatusTransition(application.status, status)) {
            throw new BadRequestException(
                `Cannot change application status from ${application.status} to ${status}`,
            )
        }

        const updatedApplication = await this.prisma.application.update({
            where: {
                id: application.id,
            },
            data: {
                status,
            },
        })

        return this.withCvUrl(updatedApplication)
    }

    private isValidStatusTransition(
        currentStatus: ApplicationStatus,
        nextStatus: ApplicationStatus,
    ): boolean {
        const transitions: Record<
            ApplicationStatus,
            ApplicationStatus[]
        > = {
            [ApplicationStatus.PENDING]: [
                ApplicationStatus.REVIEWING,
                ApplicationStatus.REJECTED,
            ],
            [ApplicationStatus.REVIEWING]: [
                ApplicationStatus.ACCEPTED,
                ApplicationStatus.REJECTED,
            ],
            [ApplicationStatus.ACCEPTED]: [],
            [ApplicationStatus.REJECTED]: [],
            [ApplicationStatus.WITHDRAWN]: [],
        }

        return transitions[currentStatus].includes(nextStatus)
    }
}