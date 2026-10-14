# Gig Studio Pro

Repertoire, setlist and stage-performance tools for working musicians: manage songs and setlists, transpose keys, read charts and lyrics in performance mode, and share a public repertoire or gig page.

## Stack

- **Web app:** React 18, TypeScript, Vite, React Router, Tailwind CSS, shadcn/ui (Radix), TanStack Query, Tone.js for audio.
- **Backend:** Supabase (auth, Postgres, storage). Edge functions live in `supabase/functions/`, schema migrations in `supabase/migrations/`.
- **Audio worker:** `main.py` is a small Flask service (yt-dlp + ffmpeg) for audio extraction, packaged by the `Dockerfile`.

## Getting started

```bash
pnpm install
pnpm dev        # start the Vite dev server
pnpm build      # production build (also generates the PWA service worker)
pnpm lint       # ESLint
npx tsc -p tsconfig.app.json --noEmit   # type-check
```

## Project layout

- `src/pages/` – route-level screens (lazy-loaded in `src/components/MainLayout.tsx`).
- `src/components/` – feature components; `src/components/ui/` holds the shadcn/ui primitives.
- `src/hooks/` – reusable hooks (audio, settings, suggestions, etc.).
- `src/utils/` – pure helpers (key/chord maths, search, setlist generation, storage).
- `src/integrations/supabase/` – generated Supabase client.

Routes are defined in `src/components/MainLayout.tsx`. Routes under `ProtectedRoute` require sign-in; the public gig and repertoire pages do not.

## Configuration notes

- The Supabase client config is in `src/integrations/supabase/client.ts` (marked as generated).
- The audio worker URL is set in `src/components/MainLayout.tsx`.
