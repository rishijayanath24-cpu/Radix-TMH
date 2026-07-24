// Pre-seeded demo accounts, prefilled on each role's login page so you never
// have to retype credentials during a demo.
//
// Create these once in Supabase WITHOUT hitting the email rate limit:
//   Supabase → Authentication → Users → "Add user"
//   → tick "Auto Confirm User" (sends no email) → use the email/password below.
// Then make the admin an admin:
//   update public.profiles set role='admin' where email='admin@radix.demo';
// (For candidate/employer, set role the same way, or sign them up via the app
//  once email confirmation is turned OFF.)

export const DEMO_ACCOUNTS = {
  candidate: { email: 'candidate@radix.demo', password: 'radixdemo123', label: 'Candidate' },
  employer:  { email: 'employer@radix.demo',  password: 'radixdemo123', label: 'Employer' },
  admin:     { email: 'admin@radix.demo',     password: 'radixdemo123', label: 'Admin' },
}

export const ROLE_COPY = {
  candidate: {
    title: 'Find your job match',
    blurb: 'Upload your résumé, build a profile, and see exactly how ready you are for each role.',
  },
  employer: {
    title: 'Hire the right talent',
    blurb: 'Post job descriptions and see which candidates match across all 12 skillsets.',
  },
  admin: {
    title: 'Admin console',
    blurb: 'Manage companies, skillset expectation bars, and user roles.',
  },
}
