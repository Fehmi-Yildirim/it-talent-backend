import { ApiProperty } from '@nestjs/swagger';

class JobDetailSkillDto {
    @ApiProperty()
    id: string;


    @ApiProperty()
    name: string;


}

class JobDetailRequirementDto {
    @ApiProperty()
    id: string;


    @ApiProperty()
    skillId: string;

    @ApiProperty()
    required: boolean;

    @ApiProperty()
    minimumLevel: number;

    @ApiProperty({ type: JobDetailSkillDto })
    skill: JobDetailSkillDto;


}

class JobDetailCompanyDto {
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

export class JobDetailResponseDto {
    @ApiProperty()
    id: string;


    @ApiProperty()
    companyId: string;

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

    @ApiProperty({ type: JobDetailCompanyDto })
    company: JobDetailCompanyDto;

    @ApiProperty({
        type: [JobDetailRequirementDto],
    })
    requirements: JobDetailRequirementDto[];


}
