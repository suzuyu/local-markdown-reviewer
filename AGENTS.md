# Agent Instructions

This repository keeps reusable agent workflows under `.agents/skills/`.

## Available Skills

- `.agents/skills/release/SKILL.md`
  - Use when preparing the repository for a public GitHub release.
  - Covers release branches, PR preparation, README/LICENSE/.gitignore checks, release notes, tags, and GitHub Release drafts.

## Repository Notes

- Keep downloaded third-party browser bundles such as `mermaid.min.js` and `markdown-it.min.js` out of Git.
- Keep generated review data under `.local-markdown-reviewer/` out of this tool repository.
- Prefer branch and PR based changes for public release preparation.

## GitHub Policies

- Never push directly to `main`.
- Always create a working branch before committing.
- Use `<type>/<short-name>` branch names.
- Prefer `feature/<short-name>` for product changes.
- Use `docs/<short-name>` for documentation-only changes.
- Use `chore/<short-name>` for release preparation or repository maintenance.
- PR review is required before merge.
- Never publish releases without human approval.
- Never commit secrets.
- Never force-push protected branches.
