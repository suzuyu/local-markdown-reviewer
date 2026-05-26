---
name: release
description: Use this skill when preparing this repository for public GitHub release, including release branches, PR preparation, README/LICENSE/.gitignore checks, ignored generated files, release notes, tags, and GitHub Release drafts.
metadata:
  short-description: Prepare GitHub release branches, PRs, and release notes
---

# Release

Use this workflow when preparing this repository for public GitHub release, creating a release branch, drafting release notes, or making a PR for release preparation.

## Default Approach

Prefer a branch and PR workflow instead of committing directly to `main`.

Follow the repository GitHub policies in `AGENTS.md`: never push directly to `main`, never force-push protected branches, never commit secrets, require PR review before merge, and never publish releases without human approval.

Default names:

- Branch: `chore/public-release-prep`
- Commit: `Prepare repository for public release`
- PR title: `Prepare public release`

Use the repository branch naming policy from `AGENTS.md`: `<type>/<short-name>`. For product changes prefer `feature/<short-name>`, for documentation-only changes use `docs/<short-name>`, and for release preparation or repository maintenance use `chore/<short-name>`.

## Branch Ownership

By default, the agent creates the working branch after checking the current branch and worktree.

Before creating or reusing a branch:

```sh
git status --short
git branch --show-current
```

Branch rules:

- If already on `main`, create a new working branch before editing or committing.
- If already on a non-`main` working branch, ask whether to reuse it when the intent is unclear.
- If the user has already created a suitable branch, use it unless it conflicts with the requested work.
- Never commit directly to `main`.
- Never force-push protected branches.

Branch naming follows `AGENTS.md`: `<type>/<short-name>`.

Examples:

- Product change: `feature/comment-position-tracking`
- Documentation-only change: `docs/update-release-usage`
- Release preparation: `chore/public-release-prep`

## Preflight

Inspect the repository before editing:

```sh
git status --short
rg --files
```

Check for generated, local, or sensitive files:

```sh
rg -n "password|secret|token|api[_-]?key|private key|BEGIN .*PRIVATE" .
git check-ignore <candidate-files>
```

Do not remove or revert user changes. If the worktree is dirty, identify which changes are relevant and work with them.

## Files To Check

For public release readiness, check or create:

- `README.md`
- `LICENSE`
- `.gitignore`
- release notes or GitHub Release body
- optional `CHANGELOG.md` if the project already uses one

Common `.gitignore` entries:

```gitignore
.DS_Store
Thumbs.db
.env
.env.*
*.log
*.tmp
*.swp
```

Add project-specific generated files, downloaded bundles, build output, local databases, and runtime review data.

## README Checklist

Ensure the README explains:

- what the project does
- who it is for
- requirements
- installation or setup
- quick start usage
- important features
- limitations
- data storage behavior
- license
- third-party dependency handling

Remove development-only notes, local machine assumptions, and stale names.

## License

If the user has no preference, recommend MIT for small utility projects intended for broad reuse.

Use this copyright holder unless the user provides a specific one:

```text
Copyright (c) <year> <project name> contributors
```

Use the current year from the environment date.

## Release Notes

Determine the release version before drafting final notes:

- For the initial public release, prefer `v0.1.0`.
- For later releases, infer the next SemVer version from existing tags and the change scope, or ask the user.
- Use placeholders such as `<version>` and `<release-title>` until the user or repository history confirms the exact version.
- Write release notes in Japanese by default for this repository, including PR release-note drafts and GitHub Release notes. Keep command names, file paths, version numbers, and option names in their original spelling.
- Separate PR context from publishable GitHub Release notes. The notes file passed to `gh release create --notes-file` must contain only publishable release notes, not PR-only sections such as checks, review notes, or summaries.
- Before publishing a GitHub Release, confirm the notes file does not contain draft labels such as `案`, `Draft`, `draft`, `<version>`, or `<release-title>`.

Draft release notes with:

- version and release title
- highlights
- feature list
- breaking changes, if any
- limitations or notes
- upgrade/setup notes

For an initial release, this Japanese shape is a good default:

```md
## v0.1.0 - 初回リリース

### ハイライト

### 主な機能

### 補足
```

## Branch And PR Workflow

If asked to perform the GitHub workflow, use:

```sh
git switch -c chore/public-release-prep
git add <files>
git commit -m "Prepare repository for public release"
git push -u origin chore/public-release-prep
gh pr create --title "Prepare public release" --body-file <body-file>
```

Before running `git push` or `gh pr create`, verify remotes:

```sh
git remote -v
```

If `gh` is not authenticated or there is no remote, provide exact next commands instead of guessing.

## Tag And GitHub Release

After PR merge, suggest:

```sh
git switch main
git pull
git tag <version>
git push origin <version>
```

Then create a GitHub Release using the drafted release notes.

Before creating the GitHub Release, run a final notes check:

```sh
rg -n "案|Draft|draft|<version>|<release-title>" <notes-file>
```

If this command finds any match, rewrite the notes file before publishing. Do not publish release notes that still contain draft markers.

For this repository, do not attach local-version release assets manually. Users fetch the local-version files from tag-specific raw GitHub URLs documented in `README.md`.

Do not attach downloaded optional browser bundles such as `mermaid.min.js` or `markdown-it.min.js`; README documents how users can fetch them when needed.

If the user asks an agent to create the release and `gh` is available:

```sh
gh release create <version> --title "<version> - <release-title>" --notes-file <notes-file>
```

## Final Response

Summarize:

- files changed
- checks performed
- branch/PR/tag commands run or recommended
- remaining manual GitHub steps

Keep the final response concise and include exact commands when useful.
