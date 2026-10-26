import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
    Type,
    mixin,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'

export function CvUploadInterceptor(): Type<NestInterceptor> {
    @Injectable()
    class CvUploadInterceptorMixin implements NestInterceptor {
        private readonly delegate: NestInterceptor

        constructor(configService: ConfigService) {
            const maxFileSize = configService.get<number>(
                'CV_MAX_FILE_SIZE_BYTES',
                10 * 1024 * 1024,
            )

            const MulterInterceptor = FileInterceptor('cv', {
                limits: {
                    fileSize: maxFileSize,
                    files: 1,
                },
            })

            this.delegate = new MulterInterceptor()
        }

        intercept(context: ExecutionContext, next: CallHandler) {
            return this.delegate.intercept(context, next)
        }
    }

    return mixin(CvUploadInterceptorMixin)
}