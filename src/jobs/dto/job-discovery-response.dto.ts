import { ApiProperty } from '@nestjs/swagger';

class JobDiscoverySkillDto {
    @ApiProperty()
    id: string;


    @ApiProperty()
    name: string;


}

class JobDiscoveryRequirementDto {
    @ApiProperty()
    id: string;


    @ApiProperty()
    skillId: string;

    @ApiProperty()
    required: boolean;

    @ApiProperty()
    minimumLevel: number;

    @ApiProperty({ type: JobDiscoverySkillDto })
    skill: JobDiscoverySkillDto;

}

class JobDiscoveryCompanyDto {
    @ApiProperty()
    id: string;


    @ApiProperty()
    name: string;

    @ApiProperty()
    slug: string;

    @ApiProperty({ nullable: true })
    website: string | null;

    @ApiProperty({ nullable: true })
    description: string | null;

    @ApiProperty({ nullable: true })
    location: string | null;


}

class JobDiscoveryItemDto {
    @ApiProperty()
    id: string;


    @ApiProperty()
    companyId: string;

    @ApiProperty()
    createdByRecruiterId: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;

    @ApiProperty({ nullable: true })
    location: string | null;

    @ApiProperty({
        enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP'],
    })
    employmentType: string;

    @ApiProperty({
        enum: ['REMOTE', 'HYBRID', 'ONSITE', 'FLEXIBLE'],
    })
    workMode: string;

    @ApiProperty({ nullable: true, type: String })
    salaryMin: string | null;

    @ApiProperty({ nullable: true, type: String })
    salaryMax: string | null;

    @ApiProperty({ nullable: true })
    currency: string | null;

    @ApiProperty()
    status: string;

    @ApiProperty({ nullable: true })
    publishedAt: Date | null;

    @ApiProperty({ nullable: true })
    expiresAt: Date | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty({ type: JobDiscoveryCompanyDto })
    company: JobDiscoveryCompanyDto;

    @ApiProperty({
        type: [JobDiscoveryRequirementDto],
    })
    requirements: JobDiscoveryRequirementDto[];

}

export class JobDiscoveryResponseDto {
    @ApiProperty({
        type: [JobDiscoveryItemDto],
    })
    items: JobDiscoveryItemDto[];

    @ApiProperty()
    total: number;

    @ApiProperty({
        example: 1,
    })
    page: number;

    @ApiProperty({
        example: 20,
    })
    limit: number;

    @ApiProperty({
        example: 5,
    })
    totalPages: number;


}
