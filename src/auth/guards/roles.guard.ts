import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { UserRole } from '../../../generated/prisma/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user?: {
    role: UserRole;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user || !requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
