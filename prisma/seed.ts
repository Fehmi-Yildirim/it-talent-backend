import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { generateSkillSlug } from '../src/skills/skill-slug.util';

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    // ------------------------------------------------------------
    // SKILL
    // ------------------------------------------------------------
    const standardSkills = [
      // Frontend
      {
        name: 'React',
        category: 'FRONTEND',
      },
      {
        name: 'Vue.js',
        category: 'FRONTEND',
      },
      {
        name: 'Angular',
        category: 'FRONTEND',
      },
      {
        name: 'JavaScript',
        category: 'FRONTEND',
      },
      {
        name: 'TypeScript',
        category: 'FRONTEND',
      },
      {
        name: 'HTML',
        category: 'FRONTEND',
      },
      {
        name: 'CSS',
        category: 'FRONTEND',
      },
      {
        name: 'Tailwind CSS',
        category: 'FRONTEND',
      },

      // Backend
      {
        name: 'Node.js',
        category: 'BACKEND',
      },
      {
        name: 'Java',
        category: 'BACKEND',
      },
      {
        name: 'C#',
        category: 'BACKEND',
      },
      {
        name: 'Python',
        category: 'BACKEND',
      },
      {
        name: 'PHP',
        category: 'BACKEND',
      },
      {
        name: 'Go',
        category: 'BACKEND',
      },
      {
        name: 'Ruby',
        category: 'BACKEND',
      },
      {
        name: '.NET',
        category: 'BACKEND',
      },
      {
        name: 'REST API',
        category: 'BACKEND',
      },
      {
        name: 'GraphQL',
        category: 'BACKEND',
      },

      // Fullstack
      {
        name: 'MERN',
        category: 'FULLSTACK',
      },
      {
        name: 'MEAN',
        category: 'FULLSTACK',
      },
      {
        name: 'Next.js',
        category: 'FULLSTACK',
      },
      {
        name: 'Full-stack development',
        category: 'FULLSTACK',
      },

      // Mobile
      {
        name: 'React Native',
        category: 'MOBILE',
      },
      {
        name: 'Flutter',
        category: 'MOBILE',
      },
      {
        name: 'Swift',
        category: 'MOBILE',
      },
      {
        name: 'Kotlin',
        category: 'MOBILE',
      },
      {
        name: 'Android',
        category: 'MOBILE',
      },
      {
        name: 'iOS',
        category: 'MOBILE',
      },

      // DevOps
      {
        name: 'Docker',
        category: 'DEVOPS',
      },
      {
        name: 'Kubernetes',
        category: 'DEVOPS',
      },
      {
        name: 'CI/CD',
        category: 'DEVOPS',
      },
      {
        name: 'Jenkins',
        category: 'DEVOPS',
      },
      {
        name: 'GitHub Actions',
        category: 'DEVOPS',
      },
      {
        name: 'Terraform',
        category: 'DEVOPS',
      },
      {
        name: 'Ansible',
        category: 'DEVOPS',
      },

      // Cloud
      {
        name: 'AWS',
        category: 'CLOUD',
      },
      {
        name: 'Azure',
        category: 'CLOUD',
      },
      {
        name: 'Google Cloud',
        category: 'CLOUD',
      },
      {
        name: 'Firebase',
        category: 'CLOUD',
      },

      // Data
      {
        name: 'Data Analysis',
        category: 'DATA',
      },
      {
        name: 'Pandas',
        category: 'DATA',
      },
      {
        name: 'NumPy',
        category: 'DATA',
      },
      {
        name: 'Power BI',
        category: 'DATA',
      },
      {
        name: 'Tableau',
        category: 'DATA',
      },
      {
        name: 'Apache Spark',
        category: 'DATA',
      },

      // AI / ML
      {
        name: 'Machine Learning',
        category: 'AI_ML',
      },
      {
        name: 'Deep Learning',
        category: 'AI_ML',
      },
      {
        name: 'TensorFlow',
        category: 'AI_ML',
      },
      {
        name: 'PyTorch',
        category: 'AI_ML',
      },
      {
        name: 'NLP',
        category: 'AI_ML',
      },
      {
        name: 'Generative AI',
        category: 'AI_ML',
      },

      // Security
      {
        name: 'Cybersecurity',
        category: 'SECURITY',
      },
      {
        name: 'Penetration Testing',
        category: 'SECURITY',
      },
      {
        name: 'OWASP',
        category: 'SECURITY',
      },
      {
        name: 'Network Security',
        category: 'SECURITY',
      },
      {
        name: 'Identity & Access Management',
        category: 'SECURITY',
      },

      // Database
      {
        name: 'PostgreSQL',
        category: 'DATABASE',
      },
      {
        name: 'MySQL',
        category: 'DATABASE',
      },
      {
        name: 'MongoDB',
        category: 'DATABASE',
      },
      {
        name: 'Redis',
        category: 'DATABASE',
      },
      {
        name: 'SQL',
        category: 'DATABASE',
      },
      {
        name: 'NoSQL',
        category: 'DATABASE',
      },

      // Testing
      {
        name: 'Jest',
        category: 'TESTING',
      },
      {
        name: 'Vitest',
        category: 'TESTING',
      },
      {
        name: 'Cypress',
        category: 'TESTING',
      },
      {
        name: 'Playwright',
        category: 'TESTING',
      },
      {
        name: 'Selenium',
        category: 'TESTING',
      },
      {
        name: 'Unit Testing',
        category: 'TESTING',
      },
      {
        name: 'Integration Testing',
        category: 'TESTING',
      },

      // Project Management
      {
        name: 'Agile',
        category: 'PROJECT_MANAGEMENT',
      },
      {
        name: 'Scrum',
        category: 'PROJECT_MANAGEMENT',
      },
      {
        name: 'Kanban',
        category: 'PROJECT_MANAGEMENT',
      },
      {
        name: 'Jira',
        category: 'PROJECT_MANAGEMENT',
      },
      {
        name: 'Project Management',
        category: 'PROJECT_MANAGEMENT',
      },

      // Design
      {
        name: 'UI Design',
        category: 'DESIGN',
      },
      {
        name: 'UX Design',
        category: 'DESIGN',
      },
      {
        name: 'Figma',
        category: 'DESIGN',
      },
      {
        name: 'Adobe XD',
        category: 'DESIGN',
      },
      {
        name: 'Responsive Design',
        category: 'DESIGN',
      },

      // Other
      {
        name: 'Git',
        category: 'OTHER',
      },
      {
        name: 'GitHub',
        category: 'OTHER',
      },
      {
        name: 'Linux',
        category: 'OTHER',
      },
      {
        name: 'Bash',
        category: 'OTHER',
      },
      {
        name: 'Technical Writing',
        category: 'OTHER',
      },
    ] as const;

    for (const skill of standardSkills) {
      const slug = generateSkillSlug(skill.name);

      await prisma.skill.upsert({
        where: { slug },
        update: {},
        create: {
          name: skill.name,
          slug,
          category: skill.category,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
