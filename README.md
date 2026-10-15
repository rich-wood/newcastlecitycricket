# Newcastle City fixtures

A one-page site listing every Newcastle City & Eastern Districts CC game, with a venue map, PlayHQ game-centre links and Google Maps directions. Defaults to the current Wednesday–Tuesday week, with Past/Upcoming filters for the rest of the season. GitHub refreshes it every Tuesday morning.

## Files

| File | What it does |
|---|---|
| `index.html` | The page. Plain HTML/CSS/JS, no build step. Reads `data.json`. Filters: All/Juniors/Seniors, and Past/This Week/Upcoming. |
| `data.json` | Every game for the season, past and future. `from`/`to` mark the current Wednesday–Tuesday week, the default view. Rewritten by the script each run. |
| `basemap.jpg` | Static OpenStreetMap image (zoom 12, lat −32.55 to −33.15, lng 151.35 to 151.95). Pins are placed on it from venue coordinates. |
| `scripts/fetch-fixtures.mjs` | Node 18+ script, no packages. Finds the club's current seasons and teams on PlayHQ and writes the current week's games to `data.json`. |
| `.github/workflows/update.yml` | Runs the script on a schedule or on demand, commits `data.json`, and publishes the site to GitHub Pages. |

## Setup (about 5 minutes)

1. Create a new repository on GitHub (public is simplest; private needs a paid plan for Pages), e.g. `newcastlecitycricket`.
2. Upload everything in this folder, keeping the `.github/workflows` folder. Either drag the files into "Add file → Upload files", or:
   ```
   git init && git add . && git commit -m "Fixtures site"
   git branch -M main
   git remote add origin https://github.com/<you>/newcastlecitycricket.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Actions** tab → enable workflows if asked → **Update fixtures → Run workflow**.
5. When it goes green (about a minute), the site is at `https://<you>.github.io/newcastlecitycricket/`.

## Updating

- **Automatic:** every Tuesday at 6:58am (Sydney daylight time). GitHub's scheduled runs can start up to ~30 minutes late. To add more runs (say Friday afternoon), add a line under `schedule:` in `update.yml`.
- **Update now:** open the site once as `https://<you>.github.io/newcastlecitycricket/?admin`. That browser then shows an **Update now** button, which opens the workflow on GitHub; click **Run workflow**. Visitors without `?admin` don't see the button.
- **If PlayHQ changes something** and the script fails, the run fails (GitHub emails you) and the site keeps the last good data.

## Run it locally

```
node scripts/fetch-fixtures.mjs                      # writes data.json for the current Wed–Tue week
node scripts/fetch-fixtures.mjs --date 2026-10-20    # pretend today is 20 Oct
python3 -m http.server 8000                          # then open http://localhost:8000
```

## Notes

- Data comes from the same GraphQL service PlayHQ's public pages use (`api.playhq.com/graphql`). It isn't a documented public API, so it may change without notice. PlayHQ may give clubs an official API key; if one becomes available, only `gq()` in the script needs changing.
- To use this for another club, change `orgId` and `orgSlug` at the top of the script (both are in the club's PlayHQ URL). If its venues are outside the Newcastle area, the map image would need regenerating.
- Map data © OpenStreetMap contributors (ODbL). Keep the credit under the map.
