# Awards Night Bingo: shared agent context

This is the canonical project context for any coding assistant: Codex, ChatGPT, Claude, OpenCode, Cursor, or another agent. Read it before changing this app. If your tool does not discover `AGENTS.md` automatically, explicitly load it. No vendor-specific context file is required. The user’s current instructions take priority.

## Folder boundary

The repository can host multiple gaming apps. **Keep every Bingo-specific implementation, backend file, document, script, test, screenshot and asset inside `bingo/`.** Do not put Bingo-specific files in the repository root. The root README/index are a small app directory; LICENSE, `.nojekyll` and `.gitignore` are shared infrastructure. Do not redirect the whole repository root into Bingo.

The live Pages path is `/game-awards/bingo/`; the public demo is `/game-awards/bingo/demo/`. Preserve both URLs during source reorganizations. Other apps can be siblings of `bingo/`.

All paths below are relative to `bingo/`:

| Path | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Invite-protected app UI and interactions |
| `config.js` | Public Edge Function endpoint; never credentials |
| `core.mjs` | Validation, shuffle/swap, random filling and bingo detection |
| `ideas-2026.mjs` | Exactly 200 entries, category/group/source metadata, review date |
| `sample-card.mjs` | Public Jojo sample; no live database ID or invitation |
| `demo/` | Public demo, isolated from Supabase with `connect-src 'none'` |
| `supabase/migrations/` | Database schema, grants and invoker RPC source |
| `supabase/functions/awards-bingo/index.ts` | Server-side invitation gateway |
| `scripts/create-room.mjs` | Cryptographic invitation/SQL generator; no DB connection |
| `tests/` | Node tests and transactional SQL integration checks |
| `docs/` | Step-by-step setup, user guide, research and screenshots |

## Product and design

A friends/family Game Awards watch-party app without accounts or sign-up. Users create a named 5 × 5 card and creator nickname, write predictions, rearrange squares, save into the room’s collection, and mark predictions during the show.

Use **charcoal and bright ChatGPT-style blue**. The user explicitly rejected gold. Preserve the clean restrained look, responsive layout, visible interaction feedback, and keyboard/touch support. Keep implementation details out of player flows.

The optional free centre stays fixed. Handles support pointer dragging and select-two-to-swap; keyboard users can navigate handles. Text fields remain editable without dragging.

## Behavior contracts

- Saved cards are shared within an invitation’s room. Anyone with that invite can create, view, edit and delete those cards. Nicknames are not identities or ownership checks.
- Both independent short and long invite aliases work. Raw invitations belong in URL fragments and private communications, never query strings or tracked files.
- Unsaved drafts and play marks are stored per browser/device. Marks do not synchronize among players.
- Saving an edit increments the card version and resets play progress for the new version. Stale updates/deletes must not overwrite newer edits.
- Fill with ideas fills only empty squares from all 200 entries, preserving manual text/free centre. Avoid duplicate texts, competing winners for one award, and repeated reveal picks from a project group.
- Refresh ideas randomizes the smaller suggestion selection. Full cards can be reset before generating a new random card.
- Reset predictions clears squares while keeping title, creator and the free-space setting. A saved shared card changes only when Save changes is clicked afterward.
- Reset marks clears play progress without changing predictions.
- Saved cards can be deleted in edit or view mode through the same versioned path. Ask for in-app confirmation and keep the card/draft intact on cancellation.
- After saving, Create a card starts fresh instead of silently overwriting the saved card.
- Five marks in a row, column, or either diagonal count. Highlight every completed line and keep the free centre marked.
- The public demo uses a copy of Jojo’s sample, never a real invitation or saved row. It makes no API requests, and edits disappear on reload.

## Architecture and security

The frontend POSTs to `awards-bingo`. The Edge Function checks origins, bounded body size, invitation format and action, hashes a client identifier, then calls `public.awards_bingo` with its server-side role. The invoker RPC validates invitations and expiry/revocation, enforces rate limits, scopes every operation to the matching room, validates payloads and checks versions.

All app tables are in `bingo_private`, with RLS enabled, no public policies and no anonymous/authenticated grants. Only `service_role` has schema/table access and RPC execute rights. Informational “RLS enabled, no policy” notices are expected for this intentional deny-by-default design. Do not fix permission errors by exposing private tables, adding broad policies, or switching to a privileged definer function.

`verify_jwt = false` is only appropriate because this function authenticates invitations itself. Do not remove that validation or weaken unrelated functions. CORS is additional browser protection, not the sole access check.

Never commit raw invitations, real room/card UUIDs as sample data, private player data, service-role keys, secret keys, or database passwords. A project URL is public configuration. Store token hashes only in the database. The generator uses cryptographic randomness: 128-bit short and 256-bit long tokens. Never derive tokens from names or dates.

Keep no-referrer/noindex metadata, no-store API responses, origin checks and the CSP. For self-hosting, `config.js`, the CSP `connect-src` and the Edge Function’s `allowedOrigin` must match the intended project/host. Never show private invitations in docs, demo pages, or screenshot address bars.

Limits: 250 cards per room, 180 requests/minute per hashed client identifier, 24 KB per function body. Do not silently remove safeguards. An open tab does not guarantee free-provider availability.

If asked for individual ownership, introduce actual identity/authorization rather than trusting nicknames or client IDs. Do not change existing group permissions without a deliberate product decision.

## Research contract

The 2026 pool was reviewed November 26, 2026. It contains 40 verified-nominee award picks, 70 researched game/studio predictions, and 90 original genre/trailer/show prompts. Source links support background; they do not confirm bookings or winners. Long shots are explicit. All entries and sources are in `docs/predictions-2026.md`.

Use current primary sources for nominees and project status. Avoid reveals that already happened, wrong-year/category nominations, or predictions contradicted by developer statements. Keep source records and review dates updated. Preserve exactly 200 unique texts, each at most 120 characters, unless the user deliberately changes the contract; update UI/docs/tests together if so.

The public sample is fixed. Changing it affects demo/future sample inserts, not existing saved cards.

## Commands and verification

From the repository root:

```bash
cd bingo
npm test
npm run check
```

Node.js 20+ is sufficient. No npm install, frontend build, CDN, external font, or framework is needed. Serve files over HTTP(S), not `file://`.

Tests cover validation, free centre, shuffle/swap, bingo detection, pool uniqueness, preservation of filled squares, group conflicts and secure invite generation. Add meaningful behavior tests when warranted, not tests mirroring cosmetic changes.

For backend work, inspect the actual project/schema first, check current Supabase docs and CLI help, keep changes scoped to Bingo, preserve grants/RLS, use proper migrations, run transactional checks and review advisors. Never delete real user cards as a UI test. Do not modify sibling apps or unrelated schemas.

Use the permitted browser tools for UI checks, verify changed flows and cancellation/errors, and capture real screenshots into `docs/images/`. After moving files, check imports, npm commands, docs/images, Pages routing and deploy working directories.

## Deployment and continuity

GitHub Pages publishes `main` from `/ (root)`. Bingo is served directly from its folder. Backend deployment is separate: committing source does not deploy schema/function changes.

Run Supabase CLI commands from `bingo/`, where `supabase/config.toml` lives, and use an explicit project reference. Credentials and private room provisioning records are not in this repo; consult the connected service or the user’s private context for authorized live operations.

Keep this file, `README.md` in this folder, and the detailed guides synchronized with architectural/workflow changes. Keep the root README lean. Report what shipped, what was checked and concrete limits; do not claim a new-project cloud setup was tested unless it was actually provisioned and checked.

When resuming interrupted work, current source/live state are authoritative. Check before recreating a room or sample card, and leave existing cards and invitations unchanged during source-only work.
