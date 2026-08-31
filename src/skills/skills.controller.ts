import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { UserRole } from '../../generated/prisma/enums';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { CreateSkillDto } from './dto/create-skill.dto';
import { GetSkillsDto } from './dto/get-skills.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { SkillsService } from './skills.service';

@Controller('skills')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class SkillsController {
    constructor(private readonly skillsService: SkillsService) { }

    @Get()
    findAll(@Query() dto: GetSkillsDto) {
        return this.skillsService.findAll(dto);
    }

    @Get(':id')
    findOne(
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.skillsService.findOne(id);
    }

    @Roles(UserRole.ADMIN)
    @UseGuards(RolesGuard)
    @Post()
    create(@Body() dto: CreateSkillDto) {
        return this.skillsService.create(dto);
    }

    @Roles(UserRole.ADMIN)
    @UseGuards(RolesGuard)
    @Patch(':id')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateSkillDto,
    ) {
        return this.skillsService.update(id, dto);
    }

    @Roles(UserRole.ADMIN)
    @UseGuards(RolesGuard)
    @Delete(':id')
    remove(
        @Param('id', new ParseUUIDPipe()) id: string,
    ) {
        return this.skillsService.remove(id);
    }
}