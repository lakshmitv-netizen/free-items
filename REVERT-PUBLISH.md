# How to revert the published site

The live site is served from the **`gh-pages`** branch of
`github.com/lakshmitv-netizen/free-items`
(URL: https://lakshmitv-netizen.github.io/free-items/index.html?variant=e).

## Publish history

| When | gh-pages commit | What |
|------|-----------------|------|
| Before 2026-09-20 publish | `bc99a1b` | Previous live version |
| 2026-09-20 publish | `8255408` | Current prototype + visual-quality fixes (breadcrumb AA contrast, heading hierarchy, link keyboard focus) |
| 2026-09-22 publish | `6c4f70f` | Blue scoped free-items notification added to the Cart tab (app.js v136) |
| 2026-09-23 publish | `f29dc26` | Free-items modal: Promotions column + per-reward promotions + Offers lead column removed (app.js v141) (revert target) |
| 2026-09-23 publish | `d15638f` | Free-items modal: "Offers" section renamed to "Header Rewards"; Product kept as first column in Product rewards (app.js v144) |

## To revert the live site back to what it was before this publish

```bash
cd "/Users/lakshmi.tv/Desktop/Free Items/free-items"
git push origin f29dc26:gh-pages --force
```

That restores commit `f29dc26` as the live site (allow 1–2 min for GitHub Pages
to rebuild). Nothing else — your `main` branch and local source are untouched.

To re-publish the newer (Header Rewards) version again afterward:

```bash
git push origin d15638f:gh-pages --force
```
