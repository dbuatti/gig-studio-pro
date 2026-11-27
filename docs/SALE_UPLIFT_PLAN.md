# Gig Studio Pro — Sale / Product Uplift Plan

> Living document. Tracks the work to take Gig Studio Pro from a single-owner Vercel+Supabase+Python-worker app to a sellable, multi-tenant SaaS (and eventually an exit-ready asset). Companion to `README.md`. No code changes are implied by this doc alone.

**Owner:** Daniele Buatti (current sole owner)
**Repo:** `gig-studio-pro`
**Status:** Planning (pre-uplift)
**Last updated:** 2026-11-27

---

## 0. Executive summary

Gig Studio Pro is a musician repertoire / setlist / stage-performance tool (React 18 + TS + Vite, Supabase auth/Postgres/RLS/storage/edge functions, Python Flask audio worker on Render, R2 storage, PWA, Vercel). It already has real product value: song repertoire with keys/transposition, setlist builder, performance mode, public gig/repertoire pages, audio extraction, AI-assisted planning. A robustness pass has landed (edge-function auth, worker hardening, generated types, fetch batching, error boundaries).

To be **sellable** it must become: (a) multi-tenant with organizations, (b) billable, (c) free of personal branding/content, (d) observable and supportable, (e) legally clean (RLS-complete, GDPR, ToS/privacy), and (f) transferable (infra accounts, IP, docs).

**Recommended strategy:** ship a "v1 SaaS" (single tier, org-scoped data, Stripe billing, onboarding) in **3 phases over ~10–14 weeks**, then a 4-week "exit hardening" phase. Do not chase App Store until web SaaS revenue validates demand.

---

## 1. Product & positioning for sale

### 1.1 What makes it sellable
- **Niche with pain:** working musicians/gigging bands need repertoire, setlists, transposition, performance mode. Existing tools (OnSong, BandHelper, Setlist Helper) are either iOS-only, expensive, or stale.
- **Differentiators:** public gig/repertoire sharing, AI setlist sorting/planning, audio extraction + key detection, PWA (works offline-ish on any device), PDF sheet-link navigation.
- **Asset value:** working full-stack app + Supabase schema + worker + R2 pipeline + AI integrations + domain.

### 1.2 Target buyers / segments
| Segment | Need | Willingness to pay | Notes |
|---|---|---|---|
| Solo gigging musicians | Repertoire + setlists + transposition | Low–med ($5–9/mo) | Volume play; PWA crucial |
| Gigging bands (2–6) | Shared setlists, member access | Med ($15–29/mo) | Multi-seat / org model |
| Music teachers / studios | Student repertoire, lesson plans | Med–high ($20–49/mo) | B2B-ish, needs org + seats |
| Worship teams | Sunday setlists, chord charts, keys | Med ($15–39/mo) | Large niche, recurring |
| Music directors / schools | Admin console, reporting | High ($99+/mo) | Later phase |

### 1.3 Pricing models (recommend)
- **Free tier:** 1 user, ≤25 songs, no audio extraction, no AI. Acquisition.
- **Pro (solo):** $9/mo or $79/yr — unlimited songs, audio extraction, AI setlist sorter, PWA.
- **Band (org):** $24/mo or $199/yr — up to 6 members, shared repertoire, gig pages, priority worker.
- **Studio/Church:** $49/mo — up to 25 seats, admin console, export, priority support.
- Optional one-time **lifetime** license for exit flexibility (caution: complicates MRR).

### 1.4 IP & data considerations
- [ ] Confirm ownership of all third-party assets: shadcn/ui (MIT), Radix (MIT), fonts, icons (lucide MIT), pdfjs (Apache), Tone.js (MIT). OK.
- [ ] AI provider ToS: Gemini/OpenAI usage must allow commercial resale; check data-retention settings; disable training on user data where possible.
- [ ] yt-dlp/ffmpeg: extraction is for personal use; **do not market audio download as a feature for resale** — position as "practice tracks / reference audio" and add ToS disclaimer. Legal review recommended before sale.
- [ ] R2/S3 bucket ownership + billing must transfer with sale.
- [ ] Domain (`gigstudiopro.*` or current) transfer plan; DNS.
- [ ] User data: on sale, privacy policy must allow transfer of data to acquirer (change-of-control clause) OR require consent. Decide before listing.

### 1.5 Branding removal of personal names (`danielebuatti`)
Found references:
- `src/components/SupportBanner.tsx` → `buymeacoffee.com/danielebuatti`
- `supabase/functions/github-file-sync/index.ts` → `danielebuatti/gig-studio-pro`, `danielebuatti/gig-studio-assets`
- `vercel.json` → `lyrics.danielebuatti.com` host rewrite
- Supabase project name "Song Analysis", org slug.

Actions:
- [ ] Replace Buy Me a Coffee link with product-level support (Stripe/Donorbox or remove).
- [ ] Rename GitHub repos / remove github-file-sync coupling or make repo configurable via env.
- [ ] Remove/repurpose lyrics subdomain rewrite or move to product domain.
- [ ] Rename Supabase project + org to product name.
- [ ] Audit `src/`, `public/`, `index.html`, manifest for personal name, email, phone.
- [ ] Remove debug/emergency pages from production routes (`DebugPage`, `EmergencyCleanup`) or gate behind admin.

### 1.6 Multi-tenant readiness (current state = single-user-per-account, no orgs)
Current model: `user_id` on every table; sharing via `is_repertoire_public` + slug + gig codes. No organizations, no roles, no seats. For band/studio segments this is a gap. See §2.1.

---

## 2. Technical uplift to make it a product

### 2.1 Multi-tenancy / organizations
**Approach:** add an `organizations` table + `organization_members` (user_id, org_id, role: owner/admin/member/viewer). Add `org_id` (nullable) to `repertoire`, `setlists`, `gig_sessions`, `sheet_links`, `profiles`-adjacent. Keep `user_id` as creator/owner for audit. RLS: a row is accessible if `auth.uid()` is a member of its `org_id` OR `user_id = auth.uid()` (personal workspace). Personal workspace = org_id null.

Migration steps:
- [ ] Create `organizations`, `organization_members` with RLS.
- [ ] Add `org_id UUID REFERENCES organizations(id)` to core tables (nullable).
- [ ] Backfill: for each existing user, create a personal org? Or keep null = personal. Recommend: keep null = personal; create org only on "create band".
- [ ] Update RLS policies to allow org members.
- [ ] Add `current_org_id` to user settings / session; org switcher in UI.
- [ ] Edge functions: accept `org_id` in payload and verify membership server-side (service role + explicit check), never trust client.

### 2.2 Billing (Stripe)
- [ ] Stripe account in product's own entity (not personal) before sale.
- [ ] Products/prices for Free/Pro/Band/Studio.
- [ ] Checkout + Customer Portal via Supabase Edge Function (`create-checkout`, `customer-portal`) using Stripe secret key from env.
- [ ] Webhook edge function `stripe-webhook` verifying signature, updating `subscriptions` table (`user_id`/`org_id`, plan, status, period_end, stripe_customer_id, stripe_subscription_id).
- [ ] Entitlements: a `has_feature(org, feature)` helper used in RLS and UI; gate audio extraction, AI, seats, export.
- [ ] Dunning: failed payment → grace period → downgrade to free (read-only over limit).
- [ ] Tax: Stripe Tax enabled; invoice emails.
- [ ] No card data stored locally.

### 2.3 Onboarding
- [ ] First-run wizard: create personal workspace, import songs (CSV/Spotify/Apple Music? at least CSV + manual), set default key, connect audio.
- [ ] Empty states with CTAs; sample setlist.
- [ ] Email verification + welcome email (Supabase auth hooks or Resend).
- [ ] In-app checklist ("add 5 songs", "create setlist", "share gig page").

### 2.4 Admin console
- [ ] `/admin` route gated by role claim (Supabase custom claim or `admins` table).
- [ ] Views: users/orgs, MRR, worker queue health, error counts, feature flags.
- [ ] Actions: impersonate (read-only, audited), suspend, refund trigger (link to Stripe), re-run extraction.
- [ ] Audit log table `admin_actions`.

### 2.5 Remove hardcoded personal content
- [ ] `src/data/setlists/*.json`, `backup_repertoire.json` — move to seed script or remove from bundle; never ship personal songs in product build.
- [ ] `src/data` should not be imported by app at runtime except dev seed.
- [ ] Christmas set / lyrics pages: decide — either generic "sample repertoire" or remove. Recommend: remove personal; add opt-in demo data.
- [ ] `DebugPage`, `EmergencyCleanup`, `md-audit`, `emergency-purge` edge function — admin-only or remove.

### 2.6 Configurable worker
- [ ] Worker URL from env (`VITE_WORKER_URL`), not hardcoded `RENDER_WORKER_URL`.
- [ ] Health endpoint `/healthz` returning queue depth.
- [ ] Auth: worker requires a shared secret header (`X-Worker-Token`) from edge functions; reject unauthenticated.
- [ ] Cookie/PO-token config via env only; never committed.
- [ ] Pluggable storage: R2 (default) with env-driven bucket; document.
- [ ] Graceful shutdown, retry with backoff, idempotent processing.

### 2.7 Secrets management
- [ ] All secrets in Supabase/Vercel/Render env; none in repo. Audit with `git log` for leaked keys; rotate any found.
- [ ] `.env.example` files for web, worker, functions.
- [ ] Document required env vars in `docs/ENV.md`.
- [ ] Use Supabase Vault for worker-shared secrets if needed.

### 2.8 CI/CD
- [ ] GitHub Actions: lint + typecheck + tests on PR; build; deploy preview (Vercel).
- [ ] Supabase migrations: `supabase db push` in CI on main with approval gate; migration review checklist.
- [ ] Edge functions deploy via `supabase functions deploy` in CI.
- [ ] Worker deploy via Render blueprint (render.yaml) or Docker registry.
- [ ] Release tags + changelog (semantic versioning).
- [ ] Branch protection on main.

### 2.9 Testing
- [ ] Unit tests (Vitest) for utils (chord math, transposition, setlist generation) — high value, low cost.
- [ ] Component tests for critical flows (auth, setlist editor) with Testing Library.
- [ ] E2E (Playwright) for: signup → add song → create setlist → public gig page → audio extraction (mocked).
- [ ] RLS policy tests: use Supabase local + pgTAP or a test harness asserting cross-user access denied.
- [ ] Load test worker queue (k6) before launch.

### 2.10 Observability
- [ ] Sentry (web + edge functions + worker) with source maps, release tracking, user/org context.
- [ ] Structured logging in worker (JSON) + log aggregation (Render logs / Better Stack).
- [ ] Uptime monitoring (Better Stack/UptimeRobot) for web, worker, Supabase.
- [ ] Product analytics: PostHog or Plausible (privacy-friendly) — events: signup, song added, setlist created, gig shared, extraction requested, upgrade.
- [ ] Error boundaries already present — wire to Sentry.
- [ ] Performance: Web Vitals reporting.

---

## 3. Migration paths

### 3.1 Single-user → hosted SaaS
- [ ] Freeze schema changes; tag `v0` (current single-user).
- [ ] Create staging Supabase project (clone schema via migrations, not data).
- [ ] Implement org + billing on staging; migrate own data as first tenant to validate.
- [ ] Blue/green: keep current prod running while SaaS ships; cut over via DNS when ready.
- [ ] Communication plan for existing (you) data: it becomes the seed tenant.

### 3.2 Database migrations strategy
- [ ] All schema changes as numbered migrations in `supabase/migrations/` (already pattern).
- [ ] Never edit applied migrations; new migration per change.
- [ ] Migration review: diff against `database.types.ts` regen; run `supabase db reset` locally before push.
- [ ] Backward-compatible deploys: add column nullable → deploy code → backfill → (later) constrain. Avoid breaking old clients.
- [ ] Migration rollback plan documented per release (down migration or restore from backup).
- [ ] Generated types regenerated in CI; fail build if drift.

### 3.3 Edge function deployment pipeline
- [ ] One deploy command per function group; CI deploys on main.
- [ ] Function secrets via `supabase secrets set` in CI (from secret store).
- [ ] Version/region pinning; health checks post-deploy.
- [ ] Remove CORS `*` where possible; restrict to app origins in prod.

### 3.4 Worker scaling (polling → queue)
Current: worker polls Supabase `repertoire` for `extraction_status='queued'`. Single gunicorn worker, semaphore=1. Fine for 1 user, not for SaaS.

Target:
- [ ] Introduce a job queue: **Redis + BullMQ (Node) OR** keep Python with **RQ/Celery + Redis**, or **Supabase Queues / pgmq**. Recommend pgmq (stays in Postgres, less infra) for v1; Redis if throughput demands.
- [ ] Edge function `queue-audio-extraction` enqueues job instead of flipping status; worker consumes.
- [ ] Horizontal scaling: multiple worker replicas; semaphore per pod; queue ensures no duplicate processing (visibility timeout + ack).
- [ ] Retries with exponential backoff; dead-letter queue; alert on DLQ depth.
- [ ] Separate "fast" (metadata) and "slow" (audio) queues.
- [ ] Rate-limit per user/org to prevent abuse (and YouTube blocks).

### 3.5 Storage (R2) lifecycle
- [ ] Bucket naming per env (`gigstudio-prod`, `-staging`); never share prod bucket with dev.
- [ ] Lifecycle rules: delete orphaned audio after N days of account deletion; multipart cleanup.
- [ ] Signed URLs for private assets; public only for gig pages.
- [ ] CORS on bucket restricted to app origin.
- [ ] Backup: R2 versioning + cross-region replication (optional) + periodic export manifest.
- [ ] Storage quota per plan; enforce in edge function.

### 3.6 Backup & restore
- [ ] Supabase: enable PITR (Pro plan) for prod; daily logical backups to R2/S3.
- [ ] Backup restore drill quarterly; document RTO/RPO (target RPO ≤ 24h, RTO ≤ 4h).
- [ ] Worker stateless (queue in DB/Redis) — no backup needed beyond queue.
- [ ] Document restore runbook in `docs/RUNBOOK.md`.

---

## 4. App store consideration (high level only)
- **Don't do yet.** Validate web SaaS first. Capacitor wrap is cheap later.
- If pursued: Capacitor + iOS/Android, push notifications (gig reminders), offline repertoire cache, app-store review (audio download features may trigger review scrutiny — likely need to remove/limit yt-dlp in store builds).
- Cost: Apple $99/yr, Google $25 one-time; review cycles; native maintenance burden.
- Recommendation: PWA is sufficient for v1–v2; revisit at $X MRR.

---

## 5. Security & compliance for selling

### 5.1 RLS completeness checklist
Tables requiring RLS audit (verify each has ENABLE + policies, test cross-user):
- [ ] `repertoire` (done) — verify org members can read shared org rows.
- [ ] `setlists`, `setlist_songs` (check migrations 0000/0001).
- [ ] `profiles` — users read own; public profile fields readable for public repertoire.
- [ ] `gig_sessions` — public read by code only when active; owner manage.
- [ ] `sheet_links` — owner only (currently yes).
- [ ] `follows` — read counts public; writes own.
- [ ] Any new: `organizations`, `organization_members`, `subscriptions`, `admin_actions`, `audit_log`.
- [ ] Storage buckets: policies for audio/PDF per user/org; no public write.
- [ ] Edge functions: all use auth header + getUser; service-role only where needed; validate inputs (zod).

### 5.2 Pen-test checklist (pre-launch & pre-sale)
- [ ] Auth: signup abuse, password reset poisoning, session fixation, JWT tampering.
- [ ] IDOR on all object endpoints (repertoire id, setlist id, gig code) — try cross-user.
- [ ] RLS bypass attempts via anon key + crafted queries.
- [ ] SSRF in worker (URL allowlist already; verify).
- [ ] XSS in lyrics/charts rendering (sanitize).
- [ ] CSRF on state-changing endpoints (Supabase uses Bearer; OK but verify).
- [ ] Rate limiting on auth, AI, extraction endpoints.
- [ ] Secrets not in client bundle (`VITE_` audit).
- [ ] Dependency audit (`pnpm audit`, `pip audit`).
- [ ] Headers: CSP, HSTS, X-Frame-Options (Vercel config).
- [ ] File upload validation (PDF size/type).

### 5.3 GDPR / data subject rights
- [ ] Data export: endpoint/function to export all user data (JSON + files) within 30 days.
- [ ] Deletion: account deletion cascades (already `ON DELETE CASCADE` on user_id) + storage purge + worker queue purge; confirm no orphaned rows.
- [ ] Privacy policy + cookie notice; lawful basis (contract for service).
- [ ] Data minimization: don't log PII in Sentry (scrub).
- [ ] DPA with Supabase, Stripe, Render, R2, Sentry, analytics provider.
- [ ] EU hosting option (Supabase region) — note for buyers.

### 5.4 Legal docs
- [ ] Terms of Service (acceptable use, audio extraction disclaimer, no warranty).
- [ ] Privacy Policy.
- [ ] Cookie Policy.
- [ ] Refund policy.
- [ ] DPA template (for B2B buyers).
- Recommend: engage a lawyer before sale; templates from Termly/iubenda as interim.

---

## 6. Roadmap phases with effort & risks

| Phase | Scope | Effort | Risk |
|---|---|---|---|
| **P0 — Hygiene (now)** | branding removal, env config, remove debug/personal data, CI lint/typecheck, Sentry, analytics | 1–2 wk | Low |
| **P1 — Product core** | orgs + multi-tenancy, Stripe billing, onboarding, entitlements | 4–6 wk | Med (RLS complexity) |
| **P2 — Scale & ops** | worker queue (pgmq), storage lifecycle, backups, admin console, RLS tests, E2E | 3–4 wk | Med (infra) |
| **P3 — Growth** | SEO/landing, referral, email, public pages polish, PWA offline | 2–3 wk | Low |
| **P4 — Exit hardening** | pen-test, legal, docs, transfer runbook, financials | 3–4 wk | Low–med |
| **Total** | | **13–19 wk** | |

Risks:
- **RLS regressions** when adding org scope — mitigate with policy tests + staging.
- **YouTube blocking** at scale — mitigate with per-user rate limits, cookie rotation, queue backoff; consider dropping extraction from store builds.
- **Scope creep** (teacher/school features) — defer to post-sale.
- **Solo dev bus factor** — document everything; this plan is part of it.

---

## 7. Exit / sale readiness checklist

### Code
- [ ] No personal names/emails in code, commits (rewrite history if needed), assets.
- [ ] All secrets rotated and out of git history.
- [ ] CI green; tests passing; coverage report.
- [ ] `database.types.ts` in sync.
- [ ] Dead code / debug routes removed or admin-gated.
- [ ] License file (choose: proprietary with sale, or MIT for OSS funnel — recommend proprietary core + OSS utils).

### Docs
- [ ] `README.md` (setup, env, deploy).
- [ ] `docs/ARCHITECTURE.md`, `docs/ENV.md`, `docs/RUNBOOK.md`, `docs/RLS.md`.
- [ ] API/edge function reference.
- [ ] Data model diagram.

### Legal
- [ ] ToS, Privacy, Cookie, Refund, DPA.
- [ ] IP assignment (you own it; contractor agreements if any).
- [ ] Trademark on product name (optional).

### Financials
- [ ] MRR/ARR, churn, CAC, LTV tracked (Stripe + analytics).
- [ ] Cost breakdown (Supabase, Render, R2, Vercel, Sentry, domains).
- [ ] Clean accounting; revenue in product entity.

### Infra transfer
- [ ] Domains, DNS.
- [ ] Supabase project (org transfer).
- [ ] Vercel project.
- [ ] Render worker service.
- [ ] R2 bucket + Cloudflare account.
- [ ] Stripe account (or transfer customers).
- [ ] GitHub repo ownership.
- [ ] Sentry/PostHog/monitoring accounts.
- [ ] Secret handover via secure channel; rotate post-transfer.

### Go-to-market assets
- [ ] Landing page + demo video + screenshots.
- [ ] Case studies / testimonials.
- [ ] Support channel (email/Intercom).

---

## Appendix A — Immediate next actions (P0 week 1)
1. Create `docs/` (done) and this plan (done).
2. Audit & remove personal branding (§1.5).
3. Add `.env.example` + `docs/ENV.md`.
4. Wire Sentry + PostHog.
5. Gate/remove debug routes.
6. Set up GitHub Actions for lint+typecheck+build.

## Appendix B — Files of interest
- `src/components/MainLayout.tsx` — routes + hardcoded worker URL.
- `src/components/SupportBanner.tsx` — personal Buy Me a Coffee.
- `supabase/functions/github-file-sync/index.ts` — personal repos.
- `vercel.json` — lyrics subdomain rewrite.
- `main.py` — worker (polling, single concurrency).
- `supabase/migrations/` — schema source of truth.
- `repertoire_rls_fix.sql` — RLS baseline.
- `src/data/` — personal seed data.
