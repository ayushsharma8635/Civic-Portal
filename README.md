# Civic Portal

Smart Local Grievance Redressal and Municipal Complaint Tracking System built with React, Vite, Tailwind CSS, and Supabase. Deployed on Vercel.

## Features

- **Citizens** can submit complaints, track status, view history, and receive notifications
- **Field Officers** can view assigned complaints, update status, and upload evidence
- **Admins** can manage complaints, areas, departments, officers, and view analytics
- Smart complaint categorization and department routing
- Google Maps integration for location-based complaints
- PDF receipt generation for submitted complaints
- Real-time notifications and status updates
- Google Sign-In authentication

## Prerequisites

1. [Node.js](https://nodejs.org/) v18+ installed
2. A [Supabase](https://supabase.com/) project (free tier works)
3. Clone this repository and navigate to the project directory
4. Install dependencies:

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Your Supabase anon/public API key |
| `VITE_GOOGLE_MAPS_API_KEY` | No | Google Maps API key for map features |
| `VITE_GOOGLE_CLIENT_ID` | No | Google OAuth client ID for Google Sign-In |

> **Note:** Without Supabase credentials, the app runs in demo mode using localStorage for data persistence.

## Run Locally

```bash
npm run dev
```

Open the URL printed by Vite (default: http://localhost:5173).

## Build for Production

```bash
npm run build
```

The production build is output to the `dist/` directory.

## Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com/)
3. Set the environment variables in Vercel project settings
4. Vercel auto-detects Vite and deploys

## Database Setup

Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor to create all required tables, indexes, and Row Level Security policies.

## Project Structure

```
src/
├── api/           # Supabase client and API layer
├── components/    # Reusable React components
│   ├── login/     # Login form components per role
│   └── ui/        # Shadcn/ui component library
├── hooks/         # Custom React hooks
├── lib/           # Auth context, utilities, PDF generation
├── pages/         # Page-level route components
└── utils/         # Helper utilities
```

## License

Private project.
