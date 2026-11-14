import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const IDS = {
  company: '11111111-1111-4111-8111-111111111111',

  recruiterUser: '22222222-2222-4222-8222-222222222221',
  recruiter: '22222222-2222-4222-8222-222222222222',

  candidates: [
    {
      user: '33333333-3333-4333-8333-333333333331',
      profile: '33333333-3333-4333-8333-333333333332',
    },
    {
      user: '33333333-3333-4333-8333-333333333333',
      profile: '33333333-3333-4333-8333-333333333334',
    },
    {
      user: '33333333-3333-4333-8333-333333333335',
      profile: '33333333-3333-4333-8333-333333333336',
    },
  ],

  jobs: [
    '44444444-4444-4444-8444-444444444441',
    '44444444-4444-4444-8444-444444444442',
    '44444444-4444-4444-8444-444444444443',
    '44444444-4444-4444-8444-444444444444',
    '44444444-4444-4444-8444-444444444445',
    '44444444-4444-4444-8444-444444444446',
    '44444444-4444-4444-8444-444444444447',
    '44444444-4444-4444-8444-444444444448',
    '44444444-4444-4444-8444-444444444449',
    '44444444-4444-4444-8444-444444444450',
    '44444444-4444-4444-8444-444444444451',
    '44444444-4444-4444-8444-444444444452',
  ],

  skills: {
    react: '55555555-5555-4555-8555-555555555551',
    typescript: '55555555-5555-4555-8555-555555555552',
    node: '55555555-5555-4555-8555-555555555553',
    postgres: '55555555-5555-4555-8555-555555555554',
    docker: '55555555-5555-4555-8555-555555555555',
    aws: '55555555-5555-4555-8555-555555555556',
    jest: '55555555-5555-4555-8555-555555555557',
    python: '55555555-5555-4555-8555-555555555558',
    git: '55555555-5555-4555-8555-555555555559',
    java: '55555555-5555-4555-8555-555555555560',
    csharp: '55555555-5555-4555-8555-555555555561',
    kubernetes: '55555555-5555-4555-8555-555555555562',
    mongodb: '55555555-5555-4555-8555-555555555563',
    angular: '55555555-5555-4555-8555-555555555564',
    sql: '55555555-5555-4555-8555-555555555565',
    azure: '55555555-5555-4555-8555-555555555566',
  },
};

const companyData = {
  name: 'Northstar Digital',
  slug: 'northstar-digital-demo',
  website: 'https://northstar-digital.example',
  description:
    'A fictional digital technology company created for demonstration and testing purposes.',
  location: 'Amsterdam, Netherlands',
};

const skillNames = {
  react: { name: 'React', category: 'FRONTEND' as const },
  typescript: { name: 'TypeScript', category: 'FRONTEND' as const },
  node: { name: 'Node.js', category: 'BACKEND' as const },
  postgres: { name: 'PostgreSQL', category: 'DATABASE' as const },
  docker: { name: 'Docker', category: 'DEVOPS' as const },
  aws: { name: 'AWS', category: 'CLOUD' as const },
  jest: { name: 'Jest', category: 'TESTING' as const },
  python: { name: 'Python', category: 'BACKEND' as const },
  git: { name: 'Git', category: 'OTHER' as const },
  java: { name: 'Java', category: 'BACKEND' as const },
  csharp: { name: 'C#', category: 'BACKEND' as const },
  kubernetes: { name: 'Kubernetes', category: 'DEVOPS' as const },
  mongodb: { name: 'MongoDB', category: 'DATABASE' as const },
  angular: { name: 'Angular', category: 'FRONTEND' as const },
  sql: { name: 'SQL', category: 'DATABASE' as const },
  azure: { name: 'Azure', category: 'CLOUD' as const },
};

type SkillKey = keyof typeof skillNames;

const candidatesData: {
  firstName: string;
  lastName: string;
  headline: string;
  summary: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  skills: {
    key: SkillKey;
    level: number;
    years: number;
  }[];
}[] = [
    {
      firstName: 'Emma',
      lastName: 'Jansen',
      headline: 'Frontend Developer',
      summary:
        'Frontend developer experienced in modern web applications, component architecture and accessible user interfaces.',
      location: 'Amsterdam',
      salaryMin: 42000,
      salaryMax: 52000,
      skills: [
        { key: 'react', level: 4, years: 3 },
        { key: 'typescript', level: 4, years: 3 },
        { key: 'jest', level: 3, years: 2 },
        { key: 'git', level: 4, years: 3 },
      ],
    },
    {
      firstName: 'Lucas',
      lastName: 'Bakker',
      headline: 'Full-stack Developer',
      summary:
        'Full-stack developer experienced in API development, relational databases and cloud applications.',
      location: 'Utrecht',
      salaryMin: 48000,
      salaryMax: 60000,
      skills: [
        { key: 'node', level: 4, years: 4 },
        { key: 'typescript', level: 4, years: 3 },
        { key: 'postgres', level: 3, years: 2 },
        { key: 'docker', level: 3, years: 2 },
        { key: 'git', level: 4, years: 4 },
      ],
    },
    {
      firstName: 'Sophie',
      lastName: 'Visser',
      headline: 'Junior Backend Developer',
      summary:
        'Backend developer with a strong foundation in Python, databases and software testing.',
      location: 'Rotterdam',
      salaryMin: 36000,
      salaryMax: 44000,
      skills: [
        { key: 'python', level: 3, years: 2 },
        { key: 'postgres', level: 3, years: 1 },
        { key: 'sql', level: 3, years: 2 },
        { key: 'git', level: 3, years: 2 },
      ],
    },
  ];

const jobsData: {
  title: string;
  description: string;
  location: string;
  employmentType:
  'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP';
  workMode: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'FLEXIBLE';
  salaryMin: number;
  salaryMax: number;
  requirements: {
    key: SkillKey;
    level: number;
    required: boolean;
    weight: number;
  }[];
}[] = [
    {
      title: 'Frontend Developer',
      description:
        'Build modern web applications using React and TypeScript. Work closely with designers and backend developers to create accessible digital products.',
      location: 'Amsterdam',
      employmentType: 'FULL_TIME',
      workMode: 'HYBRID',
      salaryMin: 42000,
      salaryMax: 58000,
      requirements: [
        { key: 'react', level: 3, required: true, weight: 1 },
        { key: 'typescript', level: 3, required: true, weight: 1 },
        { key: 'jest', level: 2, required: false, weight: 0.5 },
      ],
    },
    {
      title: 'Backend Developer',
      description:
        'Design and maintain backend services and REST APIs using Node.js, PostgreSQL and modern development tools.',
      location: 'Utrecht',
      employmentType: 'FULL_TIME',
      workMode: 'REMOTE',
      salaryMin: 45000,
      salaryMax: 62000,
      requirements: [
        { key: 'node', level: 3, required: true, weight: 1 },
        { key: 'postgres', level: 3, required: true, weight: 1 },
        { key: 'docker', level: 2, required: false, weight: 0.5 },
      ],
    },
    {
      title: 'Junior Software Developer',
      description:
        'A great opportunity for an early-career developer. Work on backend functionality, automated tests and database integrations.',
      location: 'Rotterdam',
      employmentType: 'FULL_TIME',
      workMode: 'HYBRID',
      salaryMin: 35000,
      salaryMax: 45000,
      requirements: [
        { key: 'python', level: 2, required: true, weight: 1 },
        { key: 'postgres', level: 2, required: false, weight: 0.5 },
        { key: 'git', level: 2, required: true, weight: 0.5 },
      ],
    },
    {
      title: 'Senior React Developer',
      description:
        'Lead frontend development and help define the architecture of scalable React applications. Mentor other developers and improve engineering standards.',
      location: 'Amsterdam',
      employmentType: 'FULL_TIME',
      workMode: 'FLEXIBLE',
      salaryMin: 60000,
      salaryMax: 75000,
      requirements: [
        { key: 'react', level: 5, required: true, weight: 1 },
        { key: 'typescript', level: 4, required: true, weight: 1 },
        { key: 'jest', level: 3, required: true, weight: 0.5 },
      ],
    },
    {
      title: 'DevOps Engineer',
      description:
        'Improve deployment pipelines and cloud infrastructure. Work with containerization, Kubernetes and automated delivery processes.',
      location: 'Eindhoven',
      employmentType: 'FULL_TIME',
      workMode: 'HYBRID',
      salaryMin: 50000,
      salaryMax: 68000,
      requirements: [
        { key: 'docker', level: 3, required: true, weight: 1 },
        { key: 'kubernetes', level: 3, required: true, weight: 1 },
        { key: 'aws', level: 2, required: false, weight: 0.5 },
        { key: 'git', level: 3, required: true, weight: 0.5 },
      ],
    },
    {
      title: 'Python Developer',
      description:
        'Develop reliable Python services and data integrations. Collaborate with product teams to deliver maintainable software.',
      location: 'Rotterdam',
      employmentType: 'FULL_TIME',
      workMode: 'REMOTE',
      salaryMin: 43000,
      salaryMax: 58000,
      requirements: [
        { key: 'python', level: 3, required: true, weight: 1 },
        { key: 'sql', level: 3, required: true, weight: 1 },
        { key: 'postgres', level: 2, required: false, weight: 0.5 },
      ],
    },
    {
      title: 'Java Software Engineer',
      description:
        'Build and maintain enterprise backend applications. Contribute to API design, code quality and automated testing.',
      location: 'The Hague',
      employmentType: 'FULL_TIME',
      workMode: 'HYBRID',
      salaryMin: 48000,
      salaryMax: 65000,
      requirements: [
        { key: 'java', level: 3, required: true, weight: 1 },
        { key: 'sql', level: 3, required: true, weight: 1 },
        { key: 'docker', level: 2, required: false, weight: 0.5 },
      ],
    },
    {
      title: 'Cloud Engineer',
      description:
        'Design and operate cloud environments, improve infrastructure reliability and support secure cloud deployments.',
      location: 'Amsterdam',
      employmentType: 'FULL_TIME',
      workMode: 'REMOTE',
      salaryMin: 52000,
      salaryMax: 70000,
      requirements: [
        { key: 'aws', level: 3, required: true, weight: 1 },
        { key: 'azure', level: 2, required: false, weight: 0.5 },
        { key: 'docker', level: 3, required: true, weight: 1 },
      ],
    },
    {
      title: 'Full-stack Developer',
      description:
        'Develop end-to-end product features across frontend and backend systems. Work with modern JavaScript technologies and databases.',
      location: 'Utrecht',
      employmentType: 'FULL_TIME',
      workMode: 'HYBRID',
      salaryMin: 46000,
      salaryMax: 62000,
      requirements: [
        { key: 'react', level: 3, required: true, weight: 1 },
        { key: 'node', level: 3, required: true, weight: 1 },
        { key: 'typescript', level: 3, required: true, weight: 1 },
        { key: 'postgres', level: 2, required: false, weight: 0.5 },
      ],
    },
    {
      title: 'C# .NET Developer',
      description:
        'Create backend services and business applications using C# and .NET. Help improve application architecture and maintainability.',
      location: 'Eindhoven',
      employmentType: 'FULL_TIME',
      workMode: 'ONSITE',
      salaryMin: 47000,
      salaryMax: 63000,
      requirements: [
        { key: 'csharp', level: 3, required: true, weight: 1 },
        { key: 'sql', level: 3, required: true, weight: 1 },
        { key: 'azure', level: 2, required: false, weight: 0.5 },
      ],
    },
    {
      title: 'Angular Frontend Developer',
      description:
        'Build responsive enterprise interfaces using Angular and TypeScript. Collaborate with UX designers and backend engineers.',
      location: 'Amsterdam',
      employmentType: 'CONTRACT',
      workMode: 'HYBRID',
      salaryMin: 50000,
      salaryMax: 68000,
      requirements: [
        { key: 'angular', level: 3, required: true, weight: 1 },
        { key: 'typescript', level: 3, required: true, weight: 1 },
        { key: 'jest', level: 2, required: false, weight: 0.5 },
      ],
    },
    {
      title: 'Database Developer',
      description:
        'Design, optimize and maintain relational database solutions. Work on data models, SQL queries and database performance.',
      location: 'Utrecht',
      employmentType: 'FULL_TIME',
      workMode: 'FLEXIBLE',
      salaryMin: 44000,
      salaryMax: 60000,
      requirements: [
        { key: 'postgres', level: 3, required: true, weight: 1 },
        { key: 'sql', level: 4, required: true, weight: 1 },
        { key: 'mongodb', level: 2, required: false, weight: 0.5 },
      ],
    },
  ];

function generateSkillSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  if (process.env.DEMO_SEED_ENABLED !== 'true') {
    throw new Error(
      'Demo seed is disabled. Set DEMO_SEED_ENABLED=true to enable it.',
    );
  }

  const connectionString = process.env.DATABASE_URL;
  const candidateEmail = process.env.DEMO_CANDIDATE_EMAIL;
  const candidatePassword = process.env.DEMO_CANDIDATE_PASSWORD;
  const recruiterEmail = process.env.DEMO_RECRUITER_EMAIL;
  const recruiterPassword = process.env.DEMO_RECRUITER_PASSWORD;

  if (
    !connectionString ||
    !candidateEmail ||
    !candidatePassword ||
    !recruiterEmail ||
    !recruiterPassword
  ) {
    throw new Error(
      'DATABASE_URL and all DEMO_* account environment variables are required.',
    );
  }

  if (candidateEmail.toLowerCase() === recruiterEmail.toLowerCase()) {
    throw new Error('Demo candidate and recruiter emails must be different.');
  }

  if (candidatePassword.length < 12 || recruiterPassword.length < 12) {
    throw new Error('Demo passwords must contain at least 12 characters.');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const candidatePasswordHash = await argon2.hash(candidatePassword);
    const recruiterPasswordHash = await argon2.hash(recruiterPassword);

    await prisma.$transaction(
      async (tx) => {
        // COMPANY

        const companyById = await tx.company.findUnique({
          where: { id: IDS.company },
        });

        const companyBySlug = await tx.company.findUnique({
          where: { slug: companyData.slug },
        });

        if (companyById || companyBySlug) {
          if (
            !companyById ||
            !companyBySlug ||
            companyById.id !== companyBySlug.id ||
            companyById.name !== companyData.name
          ) {
            throw new Error('Company ID or slug collision detected.');
          }
        } else {
          await tx.company.create({
            data: {
              id: IDS.company,
              ...companyData,
            },
          });
        }

        // RECRUITER ACCOUNT

        const recruiterById = await tx.user.findUnique({
          where: { id: IDS.recruiterUser },
        });

        const recruiterByEmail = await tx.user.findUnique({
          where: { email: recruiterEmail },
        });

        if (recruiterById || recruiterByEmail) {
          if (
            !recruiterById ||
            !recruiterByEmail ||
            recruiterById.id !== recruiterByEmail.id ||
            recruiterById.role !== 'RECRUITER' ||
            !(await argon2.verify(recruiterById.passwordHash, recruiterPassword))
          ) {
            throw new Error(
              'Recruiter account collision or password mismatch detected.',
            );
          }

          await tx.user.update({
            where: { id: IDS.recruiterUser },
            data: { isDemo: true },
          });
        } else {
          await tx.user.create({
            data: {
              id: IDS.recruiterUser,
              email: recruiterEmail,
              passwordHash: recruiterPasswordHash,
              firstName: 'Noah',
              lastName: 'Recruiter',
              role: 'RECRUITER',
              status: 'ACTIVE',
              isDemo: true,
            },
          });
        }

        // RECRUITER PROFILE

        const recruiterProfileById = await tx.recruiter.findUnique({
          where: { id: IDS.recruiter },
        });

        const recruiterProfileByUser = await tx.recruiter.findUnique({
          where: { userId: IDS.recruiterUser },
        });

        if (recruiterProfileById || recruiterProfileByUser) {
          if (
            !recruiterProfileById ||
            !recruiterProfileByUser ||
            recruiterProfileById.id !== recruiterProfileByUser.id ||
            recruiterProfileById.companyId !== IDS.company
          ) {
            throw new Error('Recruiter profile collision detected.');
          }
        } else {
          await tx.recruiter.create({
            data: {
              id: IDS.recruiter,
              userId: IDS.recruiterUser,
              companyId: IDS.company,
              jobTitle: 'Talent Acquisition Specialist',
            },
          });
        }

        // CANDIDATE ACCOUNTS AND PROFILES

        const candidateEmails = [
          candidateEmail,
          candidateEmail.replace('@', '+2@'),
          candidateEmail.replace('@', '+3@'),
        ];

        const candidateProfileIds: string[] = [];

        for (let index = 0; index < candidatesData.length; index++) {
          const candidate = candidatesData[index];
          const ids = IDS.candidates[index];
          const email = candidateEmails[index];

          const userById = await tx.user.findUnique({
            where: { id: ids.user },
          });

          const userByEmail = await tx.user.findUnique({
            where: { email },
          });

          if (userById || userByEmail) {
            if (
              !userById ||
              !userByEmail ||
              userById.id !== userByEmail.id ||
              userById.role !== 'CANDIDATE' ||
              !(await argon2.verify(userById.passwordHash, candidatePassword))
            ) {
              throw new Error(
                `Candidate account collision or password mismatch detected for candidate ${index + 1}.`,
              );
            }

            await tx.user.update({
              where: { id: ids.user },
              data: { isDemo: true },
            });
          } else {
            await tx.user.create({
              data: {
                id: ids.user,
                email,
                passwordHash: candidatePasswordHash,
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                role: 'CANDIDATE',
                status: 'ACTIVE',
                isDemo: true,
              },
            });
          }

          const profileById = await tx.candidate.findUnique({
            where: { id: ids.profile },
          });

          const profileByUser = await tx.candidate.findUnique({
            where: { userId: ids.user },
          });

          if (profileById || profileByUser) {
            if (
              !profileById ||
              !profileByUser ||
              profileById.id !== profileByUser.id
            ) {
              throw new Error(
                `Candidate profile collision detected for candidate ${index + 1}.`,
              );
            }
          } else {
            await tx.candidate.create({
              data: {
                id: ids.profile,
                userId: ids.user,
                headline: candidate.headline,
                summary: candidate.summary,
                location: candidate.location,
                salaryMin: candidate.salaryMin,
                salaryMax: candidate.salaryMax,
                currency: 'EUR',
                remotePreference: 'HYBRID',
                availabilityDate: new Date('2026-12-01T00:00:00.000Z'),
              },
            });
          }

          candidateProfileIds.push(ids.profile);
        }

        // SKILLS

        const skillIds: Record<SkillKey, string> = {} as Record<SkillKey, string>;

        for (const key of Object.keys(skillNames) as SkillKey[]) {
          const skill = skillNames[key];
          const slug = generateSkillSlug(skill.name);

          const existingSkill = await tx.skill.findUnique({
            where: { slug },
          });

          if (existingSkill) {
            if (
              existingSkill.name !== skill.name ||
              existingSkill.category !== skill.category
            ) {
              throw new Error(`Skill collision detected for ${skill.name}.`);
            }

            skillIds[key] = existingSkill.id;
          } else {
            const id = IDS.skills[key];

            await tx.skill.create({
              data: {
                id,
                name: skill.name,
                slug,
                category: skill.category,
              },
            });

            skillIds[key] = id;
          }
        }

        // CANDIDATE SKILLS

        for (let index = 0; index < candidatesData.length; index++) {
          const candidate = candidatesData[index];
          const candidateId = candidateProfileIds[index];

          for (const skill of candidate.skills) {
            const skillId = skillIds[skill.key];

            const existing = await tx.candidateSkill.findUnique({
              where: {
                candidateId_skillId: {
                  candidateId,
                  skillId,
                },
              },
            });

            if (!existing) {
              await tx.candidateSkill.create({
                data: {
                  candidateId,
                  skillId,
                  proficiencyLevel: skill.level,
                  yearsOfExperience: skill.years,
                  source: 'SELF_REPORTED',
                  verified: false,
                },
              });
            }
          }
        }

        // JOBS AND REQUIREMENTS

        const publishedAt = new Date('2026-11-01T09:00:00.000Z');
        const expiresAt = new Date('2027-05-01T23:59:59.000Z');

        for (let index = 0; index < jobsData.length; index++) {
          const job = jobsData[index];
          const jobId = IDS.jobs[index];

          const existingJob = await tx.job.findUnique({
            where: { id: jobId },
          });

          if (existingJob) {
            if (
              existingJob.companyId !== IDS.company ||
              existingJob.createdByRecruiterId !== IDS.recruiter ||
              existingJob.title !== job.title
            ) {
              throw new Error(`Job ID collision detected for ${job.title}.`);
            }
          } else {
            await tx.job.create({
              data: {
                id: jobId,
                companyId: IDS.company,
                createdByRecruiterId: IDS.recruiter,
                title: job.title,
                description: job.description,
                location: job.location,
                employmentType: job.employmentType,
                workMode: job.workMode,
                salaryMin: job.salaryMin,
                salaryMax: job.salaryMax,
                currency: 'EUR',
                status: 'PUBLISHED',
                publishedAt,
                expiresAt,
              },
            });
          }

          for (const requirement of job.requirements) {
            const skillId = skillIds[requirement.key];

            const existing = await tx.jobRequirement.findUnique({
              where: {
                jobId_skillId: {
                  jobId,
                  skillId,
                },
              },
            });

            if (!existing) {
              await tx.jobRequirement.create({
                data: {
                  jobId,
                  skillId,
                  minimumLevel: requirement.level,
                  required: requirement.required,
                  weight: requirement.weight,
                },
              });
            }
          }
        }

        // APPLICATIONS

        const applications = [
          {
            candidate: 0,
            job: 0,
            status: 'REVIEWING' as const,
            coverLetter:
              'I have experience with React and TypeScript and enjoy building accessible web applications.',
          },
          {
            candidate: 1,
            job: 1,
            status: 'PENDING' as const,
            coverLetter:
              'My experience with Node.js and PostgreSQL matches the requirements of this position.',
          },
          {
            candidate: 2,
            job: 2,
            status: 'ACCEPTED' as const,
            coverLetter:
              'I am excited to develop my backend skills and contribute to your engineering team.',
          },
          {
            candidate: 0,
            job: 2,
            status: 'REJECTED' as const,
            coverLetter:
              'This opportunity interests me because of the possibility to broaden my development experience.',
          },
        ];

        for (const application of applications) {
          const candidateId = candidateProfileIds[application.candidate];
          const jobId = IDS.jobs[application.job];

          const existing = await tx.application.findUnique({
            where: {
              candidateId_jobId: {
                candidateId,
                jobId,
              },
            },
          });

          if (!existing) {
            await tx.application.create({
              data: {
                candidateId,
                jobId,
                status: application.status,
                coverLetter: application.coverLetter,
              },
            });
          }
        }
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );

    console.log('Demo seed completed successfully.');
    console.log(
      'Created or verified demo company, accounts, profiles, skills, 12 jobs and applications.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    'Demo seed failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exit(1);
});
