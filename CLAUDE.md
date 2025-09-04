# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **定期試験対策やりきり支援アプリ** (Periodic Exam Preparation Support App) designed to help middle school students prepare for their regular exams. The app helps students track their study progress and enables teachers to monitor student performance.

## Current Project Status

**✅ The project has been initialized with basic Next.js and Supabase setup.** Core authentication, dashboard, and subject management features are in early implementation phase.

## Technology Stack

- **Frontend**: Next.js 14 (App Router)
- **UI Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Form Management**: React Hook Form
- **Charts**: Recharts
- **Icons**: Heroicons

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Supabase commands
npm run supabase:start    # Start local Supabase
npm run supabase:stop     # Stop local Supabase
npm run supabase:reset    # Reset database
npm run supabase:migrate  # Apply migrations
```

## Project Architecture

### Directory Structure
- `app/` - Next.js App Router pages and layouts
  - `(auth)/` - Authentication pages (login, signup)
  - `dashboard/` - Main dashboard and subject pages
  - `test/` - Test period management
- `components/` - Reusable React components
  - `auth/` - LoginForm, SignupForm
  - `dashboard/` - Header, ProgressChart, TaskList
  - `subject/` - ProgressGauge, TaskSection
  - `test-setup/` - Wizard steps for test setup
  - `ui/` - Basic UI components (Button, Card, Input, Select)
- `lib/` - Core utilities and logic
  - `context/` - AuthContext for authentication state
  - `hooks/` - Custom React hooks
  - `supabase/` - Data access layer (users, tasks, test-periods)
- `types/` - TypeScript type definitions
- `supabase/migrations/` - Database migration files

### User Roles
1. **Students** (`role: 'student'`): Task management, progress tracking
2. **Teachers** (`role: 'teacher'`): Class management, student monitoring

### Database Schema (PostgreSQL/Supabase)

- `user_profiles`: Extended user information with roles
- `classes`: Class/group management
- `test_periods`: Test period definitions with dates and subjects
- `tasks`: Individual study tasks with progress tracking
- `subjects`: Subject definitions
- `task_templates`: Reusable task templates
- `progress`: Progress tracking records

### Key Features Implementation Status

1. **Authentication**: ✅ Basic login/signup with Supabase Auth
2. **Dashboard**: 🚧 Progress visualization with Recharts
3. **Test Period Management**: 🚧 3-step wizard setup
4. **Task Management**: 🚧 CRUD operations with weighted progress
5. **Subject Details**: 🚧 Progress gauges and task sections

## Important Implementation Notes

- Mobile-first responsive design using Tailwind CSS
- All database operations use Row Level Security (RLS) policies
- Real-time updates via Supabase subscriptions
- Form validation with React Hook Form
- Type safety with TypeScript throughout

## Environment Setup

1. Copy `.env.local.example` to `.env.local`
2. Add your Supabase project credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Testing Approach

Check `package.json` for available test commands. The project uses TypeScript for type checking during build.

## Deployment

Recommended deployment on Vercel:
1. Connect GitHub repository
2. Configure environment variables
3. Deploy with automatic builds on push