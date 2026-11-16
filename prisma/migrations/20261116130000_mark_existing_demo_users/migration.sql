-- Mark existing demo accounts as demo users
UPDATE "users"
SET "isDemo" = true
WHERE "email" IN (
  'recruiter.demo@example.com',
  'candidate.demo@example.com'
);