# ClawDocu — AI Agent Guide

This folder contains code review comments stored as JSON files. AI agents working on this repo should follow this workflow to read, act on, sync, and clean up comments.

## How It Works

Comments are stored in `.clawdocu/` as JSON files that mirror the source file path:

```
.clawdocu/
  app/pages/index.vue.json
  server/api/projects.ts.json
  README.md.json
```

Each JSON file has this structure:

```json
{
  "comments": [
    {
      "id": "1777384183812",
      "selectedText": "the code text that was highlighted",
      "text": "the reviewer's comment",
      "lineNumber": 42,
      "createdAt": "2026-04-28T13:49:43.812Z"
    }
  ]
}
```

## Workflow: Read → Act → Sync → Clean

### 1. Read

When starting work on a project, read all comment files in `.clawdocu/` to understand pending feedback:

```
find .clawdocu -name "*.json" -exec cat {} \;
```

Each comment's `selectedText` shows the exact code being referenced, and `lineNumber` points to the location.

### 2. Act

Address each comment by making the requested code changes. Some common actions:

- **Refactor**: Move code, extract components, restructure
- **Fix bugs**: Resolve issues pointed out by reviewers
- **Remove unused code**: Delete dead imports, configs, or files
- **Improve documentation**: Update README, add comments

### 3. Sync

After making changes, sync to push updated comments to GitHub:

- In the UI: click the **Sync** button (red button, left of View/Raw)
- This pushes all comment changes (including deletions) to the repo via GitHub API
- Empty comment files are automatically deleted from the repo during sync

### 4. Clean

After addressing a comment and syncing:

1. **Delete the comment** via the UI delete button, or
2. **Delete the entire `.json` file** if all comments in it are resolved, or
3. **Remove the comment entry** from the JSON array if other unresolved comments remain

Then sync again to push the cleanup.

### Clean up empty folders

After deleting JSON files, remove any empty parent directories in `.clawdocu/`:

```bash
find .clawdocu -type d -empty -delete
```

## Rules

1. **Never modify `selectedText` or `lineNumber`** — these are references to the original code
2. **Delete comments after resolving** — don't leave stale comments
3. **Sync after cleanup** — deleting files locally only affects the web UI after sync
4. **Keep `.clawdocu/` clean** — remove empty directories after deleting files
5. **No reply threads** — comments are flat annotations, not discussions. If you disagree, add a new comment on the same line

## Comment Format Reference

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique timestamp-based identifier |
| `selectedText` | string | The text snippet that was highlighted |
| `text` | string | The reviewer's feedback or question |
| `lineNumber` | number | 1-indexed line number in the source file |
| `createdAt` | string | ISO 8601 timestamp |
