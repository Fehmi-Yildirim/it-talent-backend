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
    ApiBody,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompaniesService } from './companies.service';

type AuthenticatedRequest = Request & {
    user: Awaited<ReturnType<JwtStrategy['validate']>>;
};

@ApiTags('Companies')
@ApiBearerAuth('access-token')
@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
    constructor(
        private readonly companiesService: CompaniesService,
    ) { }

    @Post()
    @ApiOperation({
        summary: 'Create a company',
        description: 'Creates a company and assigns it to the authenticated recruiter.',
    })
    @ApiBody({
        type: CreateCompanyDto,
    })
    @ApiResponse({
        status: 201,
        description: 'Company created successfully.',
    })
    @ApiResponse({
        status: 403,
        description: 'Only recruiters can create a company.',
    })
    @ApiResponse({
        status: 409,
        description: 'Recruiter is already assigned to a company.',
    })
    create(
        @Req() req: AuthenticatedRequest,
        @Body() dto: CreateCompanyDto,
    ) {
        return this.companiesService.create(
            req.user.id,
            dto,
        );
    }

    @Get('me')
    @ApiOperation({
        summary: 'Get my company',
        description: 'Returns the company associated with the authenticated recruiter.',
    })
    @ApiResponse({
        status: 200,
        description: 'Company returned successfully.',
    })
    @ApiResponse({
        status: 403,
        description: 'Only recruiters can access a company.',
    })
    @ApiResponse({
        status: 404,
        description: 'Recruiter is not assigned to a company.',
    })
    getMyCompany(@Req() req: AuthenticatedRequest) {
        return this.companiesService.getMyCompany(
            req.user.id,
        );
    }

    @Patch('me')
    @ApiOperation({
        summary: 'Update my company',
        description: 'Updates the company associated with the authenticated recruiter.',
    })
    @ApiBody({
        type: UpdateCompanyDto,
    })
    @ApiResponse({
        status: 200,
        description: 'Company updated successfully.',
    })
    @ApiResponse({
        status: 403,
        description: 'Only recruiters can update a company.',
    })
    @ApiResponse({
        status: 404,
        description: 'Recruiter is not assigned to a company.',
    })
    updateMyCompany(
        @Req() req: AuthenticatedRequest,
        @Body() dto: UpdateCompanyDto,
    ) {
        return this.companiesService.updateMyCompany(
            req.user.id,
            dto,
        );
    }
}