# GEMINI.md

## Project Overview

This is a Next.js 14 web application designed to help students and teachers with exam preparation. It uses TypeScript, Tailwind CSS, and Supabase for the database and authentication. The application allows students to manage tasks, track progress, and manage their schedules. Teachers can manage classes, set test periods, and monitor student progress.

**Key Technologies:**

*   **Framework:** Next.js 14 (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **Database:** Supabase (PostgreSQL)
*   **Authentication:** Supabase Auth
*   **Form Management:** React Hook Form
*   **Icons:** Heroicons
*   **Graphs:** Recharts

## Building and Running

### 1. Environment Variables

Copy the `.env.local.example` file to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 4. Supabase

**Start the local Supabase development environment:**

```bash
npm run supabase:start
```

**Stop the local Supabase development environment:**

```bash
npm run supabase:stop
```

**Reset the local Supabase database:**

```bash
npm run supabase:reset
```

**Apply database migrations:**

```bash
npm run supabase:migrate
```

### 5. Linting

```bash
npm run lint
```

## Development Conventions

*   The project uses the Next.js App Router for routing.
*   Components are organized into `components/auth`, `components/dashboard`, and `components/ui`.
*   Reusable logic is placed in `lib`, with subdirectories for `context`, `hooks`, `supabase`, and `utils`.
*   TypeScript is used throughout the project.
*   Styling is done with Tailwind CSS.
*   Supabase is used for the database and authentication.
*   The project includes a `README.md` file with detailed setup instructions.
