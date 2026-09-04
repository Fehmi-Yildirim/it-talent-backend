import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '../../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { CandidatesService } from './candidates.service';

type AuthenticatedRequest = Request & {
  user: Awaited<ReturnType<JwtStrategy['validate']>>;
};

@ApiTags('Candidates')
@ApiBearerAuth('access-token')
@Controller('candidates')
@Roles(UserRole.CANDIDATE)
@UseGuards(JwtAuthGuard, RolesGuard)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

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
    return this.candidatesService.getMe(req.user.id);
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
    return this.candidatesService.create(req.user.id, dto);
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
    return this.candidatesService.updateMe(req.user.id, dto);
  }
}
