# BloxyEHR

Electronic Hospital Records System for Roblox — modeled after EPIC EHR.

## Features

- **Patient Chart** — Demographics, vitals, allergies, encounter history
- **Clinical Documentation** — Progress notes, SOAP notes with templates
- **Order Entry** — Medications, labs, imaging, procedures
- **Pharmacy** — Medication workflows, eMAR, Med Rec
- **Results Management** — Lab and imaging results with filtering
- **Scheduling** — Day-view calendar, appointment booking
- **In Basket** — Tasks and notifications with mark-as-read
- **Display name** — Set your name in Settings; it appears in chat, DMs, and across the app

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon/publishable key from **Settings → API**

### 2. Configure environment

Create `.env.local` (see `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
```

Do **not** set `NEXT_PUBLIC_SITE_URL` for local dev unless you need reset/confirm emails to target a deployed URL. Omitting it keeps auth links on `http://localhost:3000`.

**Vercel:** In the project **Settings → Environment Variables**, set `NEXT_PUBLIC_SITE_URL` to your live site origin (e.g. `https://your-app.vercel.app`), with **no** trailing slash. Do **not** use `http://localhost:3000` there. Redeploy after changing.

**Supabase:** Under **Authentication → URL Configuration**, set **Site URL** to that same production `https://…` URL and add `https://…/auth/callback` under **Redirect URLs**.

> Note: Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` if your template expects that name; this app uses `PUBLISHABLE_KEY` to match the Supabase Next.js starter.

### 3. Run migrations

Apply the schema to your Supabase database. Run these in order via the Supabase SQL Editor:

1. `supabase/migrations/20250217000001_initial_schema.sql` - Core tables and RLS
2. `supabase/migrations/20250217000002_problems_and_inbasket_trigger.sql` - Problem list, In Basket trigger
3. `supabase/migrations/20250217000003_role_system.sql` - Role system, patient default, manager policy, institution management
4. `supabase/migrations/20250217000004_patient_checkin_triage.sql` - Patient self check-in + triage queue workflow

### 4. Seed data (optional)

Run `supabase/seed.sql` in the SQL Editor to add sample patients.

### 5. Start the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up for an account to access the dashboard.

## Tech Stack

- Next.js 16+ (App Router)
- Supabase (PostgreSQL, Auth)
- Tailwind CSS
- Lucide React icons

## Project Structure

```
app/
  (dashboard)/     # Protected EHR modules
  auth/            # Login, signup, callback
components/
  layout/          # HyperspaceLayout, ChartSearch, NotificationCenter
  chart/           # Patient chart components
  documentation/   # Clinical notes
  orders/          # Order entry
  results/         # Results view
  schedule/        # Scheduling calendar
  inbasket/        # In Basket list
```
