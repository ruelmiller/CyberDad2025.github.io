# Archived dated-URL duplicate posts (P10, not published)

Each file here used to build to the SAME URL as another post, so Jekyll wrote only one of the two and this copy never
reached the site (it only added a duplicate entry to sitemap.xml and to the paginated post list). The files were MOVED
here unchanged (git mv, nothing deleted); folders starting with `_` are not built by Jekyll.

| Archived copy (original path) | Shared URL (still served, unchanged, by) |
|---|---|
| `_posts/2025-07-21-daily-cybersecurity-update.md` | `/2025/07/21/daily-cybersecurity-update.html` (`scripts/_posts/2025-07-21-daily-cybersecurity-update.md`) |
| `_posts/2025-07-22-daily-cybersecurity-update.md` | `/2025/07/22/daily-cybersecurity-update.html` (`scripts/_posts/2025-07-22-daily-cybersecurity-update.md`) |
| `_posts/2025-08-09-keep-your-family-safe-from-cyberbullying---expert-.md` | `/2025/08/09/keep-your-family-safe-from-cyberbullying-expert.html` (`_posts/2025-08-10-…`) |
| `scripts/_posts/2025-08-18-best-parental-controls-safety-practices-for-modern.md` | `/2025/08/18/best-parental-controls-safety-practices-for-modern.html` (`_posts/2025-08-19-…`) |
| `_posts/2025-10-30-simple-tablet-security-for-non-tech-parents.md` | `/2025/10/30/simple-tablet-security-for-non-tech-parents.html` (`_posts/2025-10-31-…`) |
| `scripts/_posts/2025-11-11-keep-your-family-safe-from-gaming-threats---expert.md` | `/2025/11/11/keep-your-family-safe-from-gaming-threats-expert.html` (`_posts/2025-11-11-…`) |
| `scripts/_posts/2025-12-14-keep-your-family-safe-from-malware---expert-tips-t.md` | `/2025/12/14/keep-your-family-safe-from-malware-expert-tips-t.html` (`_posts/2025-12-14-…`) |
| `_posts/2026-01-13-parents-alert-data-breaches-threats-and-how-to-sto.md` | `/2026/01/13/parents-alert-data-breaches-threats-and-how-to-sto.html` (`_posts/2026-01-14-…`) |

To restore one: `git mv _archive/dated-dups/<path> <path>` (or `git revert` the commit). Evidence: platform/evidence/p10/.
