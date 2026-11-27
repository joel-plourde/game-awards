# Awards Night Bingo

A blue-and-charcoal, invite-only watch-party app for The Game Awards. Static HTML, CSS and JavaScript, hosted on GitHub Pages. Supabase stores the shared card collection.

## Use

Open your host’s private invitation. Create a named 5 × 5 card, write your predictions, and save it to the collection. Drag the square handles to rearrange predictions; touch and keyboard users can also select two handles to swap. The free centre stays fixed.

Open a saved card and enter bingo mode to mark squares. Rows, columns and diagonals count. Progress is stored on the current browser/device. Editing a saved card resets progress for its new version.

Everyone with the invitation can view, create, edit and delete cards. The invitation is the room’s access credential, so share it only with your group. Use Share on a card for a direct link, Invite friends for the room link, or Print for a paper copy.

## Development

No frontend dependencies or build step. Serve the repository with a static web server. Run `npm test` and `npm run check`.

The Supabase migration and Edge Function live in `../supabase/`. The function endpoint is set in `app.js`. `tests/access.sql` checks CRUD, stale edits, invite expiry, room isolation and permissions inside a rolled-back transaction.

The backend uses the existing Supabase project with a separate `bingo_private` schema. RLS is enabled with no public policies. Only the Edge Function’s server-side service role can execute the invoker RPC and access the tables. Both short and long invitation tokens are SHA-256 hashed in the database; raw tokens must never be committed. Invite tokens stay in URL fragments, and responses use `no-store`. No service key is sent to the browser. The function limits request size and rate, checks origins, validates invitations, and restricts all actions to the matching room. Invitations support expiry and revocation. Concurrent edits use a version check.

The Pages HTML is public; the shared collection requires a valid invitation.

All icons and decorative artwork are original inline SVG/CSS. Prediction suggestions are original generic prompts. The supplied Bingo Baker page was used as a functional reference. This is an independent fan project, not affiliated with The Game Awards.
