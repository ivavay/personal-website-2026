# Ivy's Sandbox

A React + Tailwind personal blog with:

- A split-pane public blog layout inspired by your reference
- A secure `/admin` route backed by Supabase Auth
- Markdown authoring with live preview, code blocks, inline code, and image uploads
- Row-level security so only your authenticated account can write posts

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your Supabase Project URL and publishable key.

3. In Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).

4. Create your admin user in Supabase Auth.

5. Start the app:

```bash
npm run dev
```

## Deploy

This repo is ready for Vercel deployment.

1. Push the project to GitHub.
2. Import the repo into [Vercel](https://vercel.com/).
3. Add these environment variables in the Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Deploy.

Build settings:

- Build command: `npm run build`
- Output directory: `dist`

The included [`vercel.json`](./vercel.json) rewrites all routes to `index.html` so direct visits to `/admin` work in production.

## Data model

Posts include:

- `title`
- `slug`
- `excerpt`
- `content`
- `category` (`daily` or `books`)
- `pinned`
- `published`
- `published_at`

## Notes

- The public homepage reads only published posts.
- The admin page can see drafts too once signed in.
- If Supabase env vars are missing, the public page shows demo content and `/admin` shows setup instructions.
- The app accepts `VITE_SUPABASE_PUBLISHABLE_KEY` and also still supports the legacy `VITE_SUPABASE_ANON_KEY`.
