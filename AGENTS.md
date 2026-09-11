# AGENTS.md

## Project Context

This is the **Civic Portal** — a React + Vite single-page application deployed on Vercel with Supabase as the backend. It provides a smart local grievance redressal and municipal complaint tracking system.

Start with `README.md` for local setup, environment variables, and deployment workflow.

## Key Files

- `src/` — Frontend application source (React, Tailwind CSS)
- `src/api/supabaseClient.js` — Supabase client, entity repositories, auth, and API layer
- `src/lib/AuthContext.jsx` — React auth context provider
- `vite.config.js` — Vite build configuration
- `vercel.json` — Vercel SPA rewrite and headers
- `.env.example` — Required environment variables template
- `supabase/schema.sql` — Database schema and RLS policies

## Working Notes

- Use `npm run dev` to start the Vite development server locally.
- Use `npm run build` to produce the production build in `dist/`.
- Use `npm run lint` to check for ESLint errors.
- Supabase credentials must be set via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables (in `.env.local` locally, or in Vercel project settings for production).
- The app gracefully falls back to localStorage mock data when Supabase is not configured, enabling offline demo mode.
- Three user roles: **Citizen**, **Field Officer**, **Admin**.
- Do not modify the Google Sign-In singleton initialization pattern in `GoogleSignInModal.jsx` unless necessary.
