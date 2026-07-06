# Supabase setup notes

## Required environment variables

Set these in local `.env` and in Render Environment Variables:

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_xxxxxxxxxxxxxxxxx
SUPABASE_ENABLED=true
```

Keep the existing Apps Script variables during the transition:

```env
APPS_SCRIPT_WEBAPP_URL=https://script.google.com/macros/s/xxxxxxxx/exec
APPS_SCRIPT_WEBAPP_TOKEN=APPROVAL_PHASE1_SECRET
APPS_SCRIPT_WEBAPP_TIMEOUT_MS=30000
```

## Install dependency

```powershell
npm install
```

`package.json` now includes `@supabase/supabase-js`.

## Database schema

Run `supabase/schema.sql` in Supabase SQL Editor before starting the app.

## Behavior

When `SUPABASE_ENABLED=true`:

- Approval records are read from and saved to Supabase first.
- The app still tries to sync the same record to Google Sheet after saving to Supabase.
- If Google Sheet sync fails, the main Supabase save still succeeds and `sheetSync.ok` will be false.
- Shops are read from Supabase. If Supabase shops are empty, the service tries to seed them from the Google Sheet shop tab.
- Adding/updating a shop writes to Supabase first, then tries to sync to Google Sheet.

When `SUPABASE_ENABLED=false` or missing:

- The system falls back to the old Google Sheet behavior.
