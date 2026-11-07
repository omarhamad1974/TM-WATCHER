# Enhancement progress

Work is done in phases. Each phase leaves a working project. If a session stops, start the next one by saying "continue with the next phase" and attach this folder.

| Phase | Scope | Status |
|---|---|---|
| 1 | Match review (status + notes), CSV export, print/PDF report | **Done** |
| 2 | Speed: Web Worker (OffscreenCanvas) + stored fingerprints for a fast first pass | Next |
| 3 | Word marks: in-browser OCR (Tesseract.js) with spelling and sound matching | Planned |
| 4 | Catalogue management (rename, add pages, re-extract) and batch search of several source marks | Planned |
| 5 | Match highlighting overlay and keypoint matching for cropped/scaled marks | Planned |

All phases use free tools only. Anything that would need a paid service will be flagged first.

## Phase 1 upgrade steps (existing installs)

1. Supabase > SQL Editor > run `supabase/migrations/002_review.sql`.
2. Replace the project files in your repository and push.

New installs: `supabase/schema.sql` already includes the new columns.
