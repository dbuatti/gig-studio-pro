# Backup & restore runbook

Goal: recover the Supabase project (schema + data) and the R2 object store without guessing.

## Inventory

- **Supabase project ref:** `rqesjpnhrjdjnrzdhzgw`
- **Database:** Postgres + Auth + Realtime metadata
- **Storage:** Supabase Storage (including `cookies`, `public_audio` if still used)
- **R2 bucket:** configured by `S3_BUCKET_NAME` in the audio worker
- **Worker:** Render service for `main.py`
- **Web:** Vercel

## Daily/weekly database backup

Supabase Pro includes automatic backups, but keep an independent copy.

```bash
# Full schema + data (run from repo root, authenticated via `supabase login`).
supabase db dump --linked -f backups/$(date +%F)-schema.sql
supabase db dump --linked --data-only -f backups/$(date +%F)-data.sql
```

Store backups in at least two locations outside Vercel/Supabase (e.g. encrypted local archive + S3/R2 bucket with versioning). Never commit backups to this repo.

For restores, schema first, then data:

```bash
psql "$NEW_DATABASE_URL" -v ON_ERROR_STOP=1 -f backups/YYYY-MM-DD-schema.sql
psql "$NEW_DATABASE_URL" -v ON_ERROR_STOP=1 -f backups/YYYY-MM-DD-data.sql
```

> `pg_dump` output does not restore Supabase-managed roles, vault secrets, edge function configuration, or Storage object contents. Recreate those separately.

## Storage backup

### Supabase Storage

List buckets, then back up each bucket's objects and metadata. Keep the bucket policies and storage.objects rows consistent with the DB dump.

### Cloudflare R2

Use `aws s3 sync` with the worker's R2 credentials:

```bash
aws s3 sync s3://"$S3_BUCKET_NAME" ./backups/r2/$(date +%F) \
  --endpoint-url "$S3_ENDPOINT"
```

Enable R2 versioning/lifecycle rules where possible; audio files can be regenerated from YouTube, but PDFs/lead sheets and user uploads cannot.

## Worker recovery

1. Recreate Render service from this repo with the same Python build command (`Dockerfile`).
2. Set required env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `R2_PUBLIC_URL`.
3. Optional YouTube auth vars: `YOUTUBE_PO_TOKEN`, `YOUTUBE_VISITOR_DATA`, `YOUTUBE_DATA_SYNC_ID`.
4. Verify `/health` returns `{"status":"ok", ...}` and `configured.supabase/r2` are true.
5. Restore the `cookies.txt` object in the Supabase `cookies` bucket if required.

## Edge functions

Redeploy from source:

```bash
supabase functions deploy
```

Secrets must be recreated in the new project; they are not included in SQL dumps.

## Quarterly restore drill

- Create a disposable Supabase branch/project.
- Restore schema + latest data backup.
- Restore one storage sample.
- Verify a signed-in user can see their repertoire/setlists and that a public gig URL still works.
- Delete the disposable project/branch.
