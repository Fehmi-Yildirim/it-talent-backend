import {
    Body,
    Controller,
    Get,
    Patch,
    UseGuards,
} from '@nestjs/common'
import { UserRole } from '../../generated/prisma/enums'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { SettingsService } from './settings.service'
import { UpdateCvRetentionDto } from './dto/update-cv-retention.dto'

@Controller('settings')
export class SettingsController {
    constructor(
        private readonly settingsService: SettingsService,
    ) { }

    /**
     * Frontend may use this to display the current CV retention policy.
     */
    @Get('cv-retention')
    async getCvRetention() {
        return {
            days: await this.settingsService.getCvRetentionDays(),
        }
    }

    /**
     * Only administrators can change the retention policy.
     */
    @Roles(UserRole.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch('cv-retention')
    async updateCvRetention(
        @Body() dto: UpdateCvRetentionDto,
    ) {
        const setting =
            await this.settingsService.updateCvRetentionDays(dto.days)

        return {
            days: Number(setting.value),
        }
    }
}