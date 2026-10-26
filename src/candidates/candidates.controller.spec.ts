import { BadRequestException } from '@nestjs/common'
import { CandidatesController } from './candidates.controller'
import { CandidatesService } from './candidates.service'
import type { UploadedCandidateCv } from './uploaded-cv.interface'

describe('CandidatesController CV upload validation', () => {
    const candidatesServiceMock = {
        uploadCv: jest.fn(),
    }

    let controller: CandidatesController

    const request = {
        user: {
            id: 'user-1',
            email: 'candidate@example.com',
            role: 'CANDIDATE',
            status: 'ACTIVE',
        },
    } as unknown as Parameters<CandidatesController['uploadCv']>[0]

    const createFile = (
        originalname: string,
        mimetype: string,
        buffer: Buffer,
    ): UploadedCandidateCv =>
        ({
            originalname,
            mimetype,
            buffer,
            size: buffer.length,
        })

    beforeEach(() => {
        jest.clearAllMocks()

        controller = new CandidatesController(
            candidatesServiceMock as unknown as CandidatesService,
        )

        candidatesServiceMock.uploadCv.mockResolvedValue({
            success: true,
        })
    })

    it('rejects a missing file', async () => {
        await expect(
            controller.uploadCv(request, undefined),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(candidatesServiceMock.uploadCv).not.toHaveBeenCalled()
    })

    it('rejects an unsupported file extension', async () => {
        const file = createFile(
            'resume.exe',
            'application/octet-stream',
            Buffer.from('not a CV'),
        )

        await expect(
            controller.uploadCv(request, file),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(candidatesServiceMock.uploadCv).not.toHaveBeenCalled()
    })

    it('rejects a PDF with an invalid signature', async () => {
        const file = createFile(
            'resume.pdf',
            'application/pdf',
            Buffer.from('not a PDF document'),
        )

        await expect(
            controller.uploadCv(request, file),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(candidatesServiceMock.uploadCv).not.toHaveBeenCalled()
    })

    it('rejects a DOCX file that starts with PK but is not a valid ZIP archive', async () => {
        const file = createFile(
            'resume.docx',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            Buffer.from('PKgarbage'),
        )

        await expect(
            controller.uploadCv(request, file),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(candidatesServiceMock.uploadCv).not.toHaveBeenCalled()
    })

    it('accepts a PDF with the expected signature and MIME type', async () => {
        const file = createFile(
            'resume.pdf',
            'application/pdf',
            Buffer.from('%PDF-1.7 test document'),
        )

        await expect(
            controller.uploadCv(request, file),
        ).resolves.toEqual({ success: true })

        expect(candidatesServiceMock.uploadCv).toHaveBeenCalledWith(
            'user-1',
            file,
        )
    })
})
