This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Rebalancing Engine V2 Rollout

- `REBALANCE_ENGINE_V2_ENABLED=true` enables deterministic queue generation (default behavior).
- `REBALANCE_ENGINE_V2_ENABLED=false` forces legacy prompt-led scenario output.
- Send `compare_legacy: true` in `POST /api/ai/rebalance` payload to receive a parity summary between deterministic and legacy outputs during rollout.

## Shared AI User Context

- Run `src/lib/supabase/migrations_v4_user_ai_context.sql` to enable persistent user context storage.
- All AI routes now use `src/lib/personalization/user-context.ts` to read/write a per-user context snapshot from database (`user_ai_contexts`).
- Context refreshes automatically when user profile/holdings fingerprints change, and after IPS regeneration.
