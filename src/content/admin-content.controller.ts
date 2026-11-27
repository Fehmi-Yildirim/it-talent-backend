import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { UserRole } from '../../generated/prisma/enums';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentStatusDto } from './dto/update-content-status.dto';
import { UpdateContentTranslationDto } from './dto/update-content-translation.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: UserRole;
  };
}

@Controller('admin/content')
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminContentController {
  constructor(private readonly contentService: ContentService) { }

  @Get()
  findAll() {
    return this.contentService.findAll();
  }

  @Post()
  create(@Body() dto: CreateContentDto) {
    return this.contentService.create(
      dto.title,
      dto.locale,
      dto.content as Prisma.InputJsonValue,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contentService.findOne(id);
  }

  @Patch(':id/translations/:locale')
  saveTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpdateContentTranslationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Prisma.ContentTranslationGetPayload<Record<string, never>>> {
    return this.contentService.saveTranslation(
      id,
      locale,
      dto,
      request.user.id,
    );
  }

  @Patch(':id/translations/:locale/status')
  updateStatus(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpdateContentStatusDto,
  ) {
    return this.contentService.updateStatus(id, locale, dto.status);
  }

  @Post(':id/translations/:locale/publish')
  publish(@Param('id') id: string, @Param('locale') locale: string) {
    return this.contentService.publish(id, locale);
  }

  @Post(':id/translations/:locale/unpublish')
  unpublish(@Param('id') id: string, @Param('locale') locale: string) {
    return this.contentService.unpublish(id, locale);
  }

  @Delete(':id/translations/:locale')
  removeTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
  ) {
    return this.contentService.removeTranslation(id, locale);
  }

  @Delete(':id')
  removePage(@Param('id') id: string) {
    return this.contentService.removePage(id);
  }
}
