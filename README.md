# Trademark Matcher

Compare a source trademark image against every trademark in a PDF catalogue. Plain HTML, CSS and JavaScript (ES modules). No build step. Supabase provides sign-in, database and file storage. Hosts on GitHub Pages.

## What Supabase adds

- **Accounts**: email + password, or email link.
- **Catalogues**: upload a PDF once. The trademark crop from each page is stored (256 px), so later searches skip PDF parsing.
- **History**: every search is saved with its parameters and matches.
- **Saved filter settings**: name your comparison filters, save them, and reload, update or delete them later. The last one used loads automatically.
- **Review and export**: mark each saved match New / Cleared / Watch / Conflict with a note, filter History by status, download a CSV, or print a report to PDF.
- **Help tips**: a ? beside every option explains it in plain language. “Show all tips” opens every explanation at once.
- **User manual**: `docs/manual.pdf` is a full guide to every filter and metric. The app links to it from the header.
- **Privacy**: Row Level Security and storage policies limit every row and file to its owner.

The comparison itself still runs in the browser, so there is no server to maintain.

## Upgrading

See `PROGRESS.md`. For Phase 1, run `supabase/migrations/002_review.sql` once in the SQL Editor.

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Run the schema**: SQL Editor > New query > paste `supabase/schema.sql` > Run. This creates the tables, policies and the private `tm` storage bucket.
3. **Add your keys**: edit `js/config.js` with the Project URL and anon public key (Project Settings > API). Do not use the `service_role` key.
4. **Allow your site URL**: Authentication > URL Configuration. Set Site URL to `https://<user>.github.io/<repo>/` and add the same URL under Redirect URLs. Add `http://localhost:8000/` for local testing.
5. **Email confirmation**: Authentication > Providers > Email. Leave "Confirm email" on for production. Turn it off only while testing.
6. **Run locally** (ES modules need a server, not `file://`):
   ```
   python3 -m http.server 8000
   ```
   Then open http://localhost:8000.

## Deploy to GitHub Pages

1. Create a repository and push all files, with `index.html` at the root.
2. Settings > Pages > Source: **Deploy from a branch** > `main` / `(root)` > Save.
3. After a minute the site is live at `https://<user>.github.io/<repo>/`.

## Using it

1. **Catalogues** tab: choose the PDF, name it and press *Upload and extract*. Use *Extraction settings* if pages have several images or if the images are small.
2. **Compare** tab: add the source image, pick the catalogue, set the minimum similarity and parameters, then press *Compare*.
3. **History** tab: reopen or delete earlier searches.

## Limits and notes

- Supabase free plan: 1 GB storage and 50 MB per file, so PDFs above 50 MB won’t upload.
- Trademarks are compared from the stored 256 px crops. Resolution settings above 128 px have no extra effect.
- Large catalogues (thousands of marks) take time to download on the first search of a session, then stay cached until the page reloads.
- Scores are visual-similarity estimates only. They aren’t legal or phonetic trademark clearance.
- Scanned PDFs with no embedded images fall back to the whole page. Set *Take from each page* to *Whole page* if that happens often.

## Project layout

```
index.html          page
css/style.css       styles
js/config.js        Supabase URL + anon key (edit this)
js/supabase.js      client
js/engine.js        comparison metrics and variations
js/pdf.js           finds and crops the trademark on each PDF page
js/params.js        every setting, its default and its help tip (edit tips here)
js/app.js           sign-in, catalogues, compare, history, saved settings
docs/manual.pdf     user manual
supabase/schema.sql database, policies, storage bucket
```

## Possible next steps

- Move `js/engine.js` into a Web Worker (OffscreenCanvas) to keep the page responsive on very large catalogues.
- Store precomputed hashes in Postgres to pre-filter before the full comparison.
- Add a Supabase Edge Function for server-side PDF processing.
