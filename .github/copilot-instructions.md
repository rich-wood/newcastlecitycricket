# Instructions for coding agents (VS Code: Copilot agent, Claude Code, etc.)

This folder is a finished static site plus a scheduled GitHub Action. **Your job is to publish it to GitHub Pages and confirm it works.** Don't redesign or refactor anything. See README.md for what each file does.

Target: GitHub repo `newcastlecitycricket` under the user's own GitHub account, Pages served from GitHub Actions.

## 0. Tidy up

`.github/workflows/update.yml` and `.github/copilot-instructions.md` are already in place. The `setup/` folder holds spare copies of the same two files; delete it:

```
Remove-Item -Recurse setup
```

If `.github/workflows/update.yml` is missing for some reason, move `setup/update.yml` there first. Without it nothing updates.

## 1. Check tools

```
git --version
gh --version
gh auth status
node --version        # 18 or newer
```

- If `gh` is missing: `winget install --id GitHub.cli` (Windows), then restart the terminal.
- If `gh auth status` says not logged in: run `gh auth login` and let the user complete it in the browser (HTTPS, with the `repo` and `workflow` scopes). Don't continue until it's logged in.
- Get the account name: `gh api user --jq .login` (call it `<owner>` below).

## 2. Test the fetch script locally first

```
node scripts/fetch-fixtures.mjs --out data.json
```

Expect a line like `Wrote data.json: 24 games from 2026-10-14 to 2026-10-20, from 33 teams.` If it fails with an HTTP error or "PlayHQ request failed", stop and report the exact error to the user. Don't try to work around PlayHQ.

## 3. Create the repo and push

From this folder:

```
git init
git add .
git commit -m "Newcastle City fixtures site"
git branch -M main
gh repo create newcastlecitycricket --public --source . --remote origin --push
```

If a repo with that name already exists on the account, ask the user before pushing to it.

Public is required for free GitHub Pages. If the user wants it private, tell them Pages on a private repo needs a paid plan, and ask before proceeding.

## 4. Turn on Pages (source = GitHub Actions)

```
gh api -X POST repos/<owner>/newcastlecitycricket/pages -f build_type=workflow
```

If it says Pages already exists: `gh api -X PUT repos/<owner>/newcastlecitycricket/pages -f build_type=workflow`

Make sure workflows are allowed to write to the repo:

```
gh api -X PUT repos/<owner>/newcastlecitycricket/actions/permissions/workflow -f default_workflow_permissions=write
```

## 5. Run the workflow once and check it

```
gh workflow run update.yml
gh run watch $(gh run list --workflow update.yml --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

- If the "Fetch this week's fixtures" step fails, PlayHQ may be refusing requests from GitHub's servers. Report the log to the user (`gh run view --log-failed`). The site still deploys on the next push, with the committed data.json.
- If the deploy step fails with an environment/permission error, check Settings → Environments → `github-pages` allows the `main` branch, then re-run.

## 6. Verify and report

```
gh api repos/<owner>/newcastlecitycricket/pages --jq .html_url
```

Open that URL and check that the page lists games and the map shows pins. Then tell the user:

- The site URL.
- The admin link for the Update now button: `<site URL>?admin`. Opening it once enables the button in that browser.
- The schedule: Tuesdays at about 7am Sydney time, plus manual runs from the Actions tab.

## Things not to change

- `basemap.jpg` and the map constants in `index.html` (`Z`, `W`, `N`, `IW`, `IH`) belong together. Don't edit one without the other.
- `data.json` is rewritten by the workflow. Don't hand-edit it.
- Keep the "© OpenStreetMap contributors" credit under the map.
