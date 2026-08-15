# SolisAI Frontend (production)

Auto-staged from the SolisAI monorepo via `python scripts/push_frontend.py`.

- Site: **https://solisai.video** (repo: https://github.com/ppowq67/solisai)
- API: **https://api.solisai.video**
- Mild JS obfuscation (readable structure; locals renamed)
- CSS/HTML comment scrub (class/id rename is opt-in via `--mangle-dom` — off by default)
- `_review/` (source-maps) generated locally — **gitignored, never pushed**
- `admin/` excluded

## Deploy
Vercel (or any static host) from this repo root. `_review/` must not be published.
API CORS / cookies must allow `https://solisai.video`.

Generated: 2026-08-15T10:47:49.297787+00:00
