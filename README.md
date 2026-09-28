# Content Retreat SEO dashboard

Next.js app on Vercel. Once a day (07:00 IST) a Vercel Cron job calls `/api/refresh`, which:

1. Reads the page list (URL, Page Type, Primary Keyword) from `Sheet1` of the Content Retreat Performance sheet.
2. Pulls clicks, impressions and average position per URL, and the position of each page's primary keyword, from the Search Console API for every month since `START_MONTH`. The current month is marked partial.
3. Pulls leads and onboardings per landing URL and month from a saved Metabase question.

The result is cached and served to every visitor. If a refresh fails, the last good data stays up.
Without Google credentials the app shows bundled sample data (Aug–Sep 2026).

## Setup

1. **Google service account**: in Google Cloud, create a service account, enable the *Google Search Console API* and *Google Sheets API*, and download a JSON key.
   - Search Console → Settings → Users and permissions → add the service account's `client_email` (Restricted is enough).
   - Share the sheet with the same email as Viewer.
2. **Metabase**: note the saved question's ID (the number in `/question/123-...`). For access, either ask an admin for an API key (Admin → Settings → Authentication → API keys), or set `METABASE_USERNAME` / `METABASE_PASSWORD` for any account that can open the question (email + password login; Google-only sign-in won't work).
   The question needs a landing URL column and a date column, one row per lead (an onboarding flag/count column is optional).
3. **Vercel**: `vercel link`, then add every variable from `.env.example` with `vercel env add`, and deploy with `vercel deploy --prod`.

Refresh by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/refresh`

## Local

```
cp .env.example .env.local   # fill in values, or leave Google blank for sample data
npm run dev
```
