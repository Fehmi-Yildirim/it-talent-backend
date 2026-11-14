import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Request } from 'express';

interface DemoAuthenticatedRequest extends Request {
    user?: {
        isDemo?: boolean;
    };
}

@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context
            .switchToHttp()
            .getRequest<DemoAuthenticatedRequest>();

        if (request.user?.isDemo !== true) {
            return true;
        }

        const method = request.method.toUpperCase();
        const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

        if (safeMethods.includes(method)) {
            return true;
        }

        throw new ForbiddenException(
            'Demo accounts are read-only. Changes are not allowed.',
        );
    }
}
