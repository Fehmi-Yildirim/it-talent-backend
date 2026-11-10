import 'dotenv/config';
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
  skills: [
    { id: '55555555-5555-4555-8555-555555555551', slug: 'react' },
    { id: '55555555-5555-4555-8555-555555555552', slug: 'typescript' },
    { id: '55555555-5555-4555-8555-555555555553', slug: 'node-js' },
    { id: '55555555-5555-4555-8555-555555555554', slug: 'postgresql' },
    { id: '55555555-5555-4555-8555-555555555555', slug: 'docker' },
    { id: '55555555-5555-4555-8555-555555555556', slug: 'aws' },
    { id: '55555555-5555-4555-8555-555555555557', slug: 'jest' },
    { id: '55555555-5555-4555-8555-555555555558', slug: 'python' },
    { id: '55555555-5555-4555-8555-555555555559', slug: 'git' },
    { id: '55555555-5555-4555-8555-555555555560', slug: 'java' },
    { id: '55555555-5555-4555-8555-555555555561', slug: 'c' },
    { id: '55555555-5555-4555-8555-555555555562', slug: 'kubernetes' },
    { id: '55555555-5555-4555-8555-555555555563', slug: 'mongodb' },
    { id: '55555555-5555-4555-8555-555555555564', slug: 'angular' },
    { id: '55555555-5555-4555-8555-555555555565', slug: 'sql' },
    { id: '55555555-5555-4555-8555-555555555566', slug: 'azure' },
  ],
};

async function main() {
  if (process.env.DEMO_CLEANUP_ENABLED !== 'true') {
    throw new Error(
      'Demo cleanup is disabled. Set DEMO_CLEANUP_ENABLED=true to enable it.',
    );
  }

  const connectionString = process.env.DATABASE_URL;
  const candidateEmail = process.env.DEMO_CANDIDATE_EMAIL;
  const recruiterEmail = process.env.DEMO_RECRUITER_EMAIL;

  if (!connectionString || !candidateEmail || !recruiterEmail) {
    throw new Error(
      'DATABASE_URL, DEMO_CANDIDATE_EMAIL and DEMO_RECRUITER_EMAIL are required.',
    );
  }

  const databaseUrl = new URL(connectionString);

  if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
    throw new Error('Cleanup is allowed only for a local database connection.');
  }

  if ((candidateEmail.match(/@/g) ?? []).length !== 1) {
    throw new Error('DEMO_CANDIDATE_EMAIL must be a valid email address.');
  }

  const candidateEmails = [
    candidateEmail,
    candidateEmail.replace('@', '+2@'),
    candidateEmail.replace('@', '+3@'),
  ];

  const candidateUserIds = IDS.candidates.map((item) => item.user);
  const candidateProfileIds = IDS.candidates.map((item) => item.profile);
  const jobIds = IDS.jobs;
  const skillIds = IDS.skills.map((item) => item.id);

  const expectedApplications = [
    `${IDS.candidates[0].profile}:${IDS.jobs[0]}`,
    `${IDS.candidates[1].profile}:${IDS.jobs[1]}`,
    `${IDS.candidates[2].profile}:${IDS.jobs[2]}`,
    `${IDS.candidates[0].profile}:${IDS.jobs[2]}`,
  ];

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify the demo company identity.
      const company = await tx.company.findUnique({
        where: { id: IDS.company },
      });
      const companyBySlug = await tx.company.findUnique({
        where: { slug: 'northstar-digital-demo' },
      });

      if (
        (company && company.name !== 'Northstar Digital') ||
        (companyBySlug && companyBySlug.id !== IDS.company)
      ) {
        throw new Error('Demo company identity check failed. Nothing deleted.');
      }

      // Verify recruiter identity and email.
      const recruiterUser = await tx.user.findUnique({
        where: { id: IDS.recruiterUser },
      });
      const recruiterByEmail = await tx.user.findUnique({
        where: { email: recruiterEmail },
      });

      if (
        (recruiterUser &&
          (recruiterUser.email !== recruiterEmail ||
            recruiterUser.role !== 'RECRUITER')) ||
        (recruiterByEmail && recruiterByEmail.id !== IDS.recruiterUser)
      ) {
        throw new Error('Recruiter identity check failed. Nothing deleted.');
      }

      const recruiterProfile = await tx.recruiter.findUnique({
        where: { id: IDS.recruiter },
      });

      const recruiterProfileByUser = await tx.recruiter.findUnique({
        where: { userId: IDS.recruiterUser },
      });

      if (
        (recruiterProfile &&
          (recruiterProfile.userId !== IDS.recruiterUser ||
            recruiterProfile.companyId !== IDS.company)) ||
        (recruiterProfileByUser && recruiterProfileByUser.id !== IDS.recruiter)
      ) {
        throw new Error(
          'Recruiter profile identity check failed. Nothing deleted.',
        );
      }

      // Verify candidate accounts and profiles.
      for (let index = 0; index < IDS.candidates.length; index++) {
        const ids = IDS.candidates[index];
        const user = await tx.user.findUnique({
          where: { id: ids.user },
        });
        const userByEmail = await tx.user.findUnique({
          where: { email: candidateEmails[index] },
        });

        if (
          (user &&
            (user.email !== candidateEmails[index] ||
              user.role !== 'CANDIDATE')) ||
          (userByEmail && userByEmail.id !== ids.user)
        ) {
          throw new Error(
            `Candidate ${index + 1} identity check failed. Nothing deleted.`,
          );
        }

        const profile = await tx.candidate.findUnique({
          where: { id: ids.profile },
        });
        const profileByUser = await tx.candidate.findUnique({
          where: { userId: ids.user },
        });

        if (
          (profile && profile.userId !== ids.user) ||
          (profileByUser && profileByUser.id !== ids.profile)
        ) {
          throw new Error(
            `Candidate ${index + 1} profile check failed. Nothing deleted.`,
          );
        }
      }

      // Refuse to remove a company or recruiter with other jobs.
      const otherCompanyJobs = await tx.job.count({
        where: {
          companyId: IDS.company,
          id: { notIn: jobIds },
        },
      });

      const otherRecruiterJobs = await tx.job.count({
        where: {
          createdByRecruiterId: IDS.recruiter,
          id: { notIn: jobIds },
        },
      });

      const otherCompanyRecruiters = await tx.recruiter.count({
        where: {
          companyId: IDS.company,
          id: { not: IDS.recruiter },
        },
      });

      if (otherCompanyJobs || otherRecruiterJobs || otherCompanyRecruiters) {
        throw new Error(
          'Unexpected company or recruiter records found. Nothing deleted.',
        );
      }

      // Verify all demo job IDs belong to the demo company and recruiter.
      const demoJobs = await tx.job.findMany({
        where: { id: { in: jobIds } },
        select: { id: true, companyId: true, createdByRecruiterId: true },
      });

      if (
        demoJobs.some(
          (job) =>
            job.companyId !== IDS.company ||
            job.createdByRecruiterId !== IDS.recruiter,
        )
      ) {
        throw new Error('Demo job identity check failed. Nothing deleted.');
      }

      // The seed creates four applications. Refuse unexpected ones.
      const relatedApplications = await tx.application.findMany({
        where: {
          OR: [
            { candidateId: { in: candidateProfileIds } },
            { jobId: { in: jobIds } },
          ],
        },
        select: { candidateId: true, jobId: true },
      });

      const actualApplicationKeys = relatedApplications.map(
        (item) => `${item.candidateId}:${item.jobId}`,
      );

      if (
        actualApplicationKeys.some((key) => !expectedApplications.includes(key))
      ) {
        throw new Error(
          'Unexpected applications are linked to demo records. Nothing deleted.',
        );
      }

      // The seed does not create match records. Do not delete user-created matches.
      const relatedMatches = await tx.match.count({
        where: {
          OR: [
            { candidateId: { in: candidateProfileIds } },
            { jobId: { in: jobIds } },
          ],
        },
      });

      if (relatedMatches > 0) {
        throw new Error(
          'Matches are linked to demo records. Review them before cleanup. Nothing deleted.',
        );
      }

      // Delete only relationships belonging to the fixed demo profiles/jobs.
      const applicationsDeleted = await tx.application.deleteMany({
        where: {
          candidateId: { in: candidateProfileIds },
          jobId: { in: jobIds },
        },
      });

      const candidateSkillsDeleted = await tx.candidateSkill.deleteMany({
        where: { candidateId: { in: candidateProfileIds } },
      });

      const jobRequirementsDeleted = await tx.jobRequirement.deleteMany({
        where: { jobId: { in: jobIds } },
      });

      const jobsDeleted = await tx.job.deleteMany({
        where: { id: { in: jobIds } },
      });

      const candidatesDeleted = await tx.candidate.deleteMany({
        where: { id: { in: candidateProfileIds } },
      });

      const recruitersDeleted = await tx.recruiter.deleteMany({
        where: { id: IDS.recruiter },
      });

      const usersDeleted = await tx.user.deleteMany({
        where: { id: { in: [...candidateUserIds, IDS.recruiterUser] } },
      });

      // Remove only fixed-ID demo skills, and only when no other records use them.
      let skillsDeleted = 0;

      for (const skill of IDS.skills) {
        const existingSkill = await tx.skill.findUnique({
          where: { id: skill.id },
        });

        if (!existingSkill) continue;

        if (existingSkill.slug !== skill.slug) {
          throw new Error(
            `Skill ID collision detected for ${skill.slug}. Cleanup aborted.`,
          );
        }

        const candidateSkillReferences = await tx.candidateSkill.count({
          where: { skillId: skill.id },
        });
        const jobRequirementReferences = await tx.jobRequirement.count({
          where: { skillId: skill.id },
        });

        if (candidateSkillReferences === 0 && jobRequirementReferences === 0) {
          await tx.skill.delete({ where: { id: skill.id } });
          skillsDeleted++;
        }
      }

      const companyDeleted = await tx.company.deleteMany({
        where: { id: IDS.company },
      });

      return {
        applicationsDeleted: applicationsDeleted.count,
        candidateSkillsDeleted: candidateSkillsDeleted.count,
        jobRequirementsDeleted: jobRequirementsDeleted.count,
        jobsDeleted: jobsDeleted.count,
        candidatesDeleted: candidatesDeleted.count,
        recruitersDeleted: recruitersDeleted.count,
        usersDeleted: usersDeleted.count,
        skillsDeleted,
        companyDeleted: companyDeleted.count,
      };
    });

    console.log('Demo cleanup completed successfully.');
    console.log('Deleted demo records:', result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    'Demo cleanup failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exit(1);
});
