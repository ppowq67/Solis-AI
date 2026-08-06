# SolisAI Frontend (production)

Auto-staged from the SolisAI monorepo via `python scripts/push_frontend.py`.

- Site: **https://solisai.video** (repo: https://github.com/ppowq67/solisai)
- API: **https://api.solisai.video**
- Mild JS obfuscation (readable structure; locals renamed)
- CSS/HTML comment scrub only
- `_review/source-maps/` generated locally for security review — **gitignored, never pushed**
- `admin/` excluded

## Deploy
Vercel (or any static host) from this repo root. `_review/` must not be published.
API CORS / cookies must allow `https://solisai.video`.

Generated: 2026-08-06T20:38:35.596245+00:00
