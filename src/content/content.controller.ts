import { Controller, Get, Param } from '@nestjs/common';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get(':slug/:locale')
  findPublished(@Param('slug') slug: string, @Param('locale') locale: string) {
    return this.contentService.findPublished(slug, locale);
  }
}
