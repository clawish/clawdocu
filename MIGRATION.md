# ClawDocu Comment Migration Guide

## v0.4.8 → v0.4.9 Migration

This version changes the comment storage format from separate JSON files to a single `comments.json` file.

### What Changed

**Before (v0.4.8):**
```
.clawdocu-comments/
  ├── TEST-GUIDE.md.json
  ├── README.md.json
  └── docs/
      └── guide.md.json
```

**After (v0.4.9):**
```
.clawdocu/
  └── comments.json
```

### New Structure

```json
{
  "files": [
    {
      "path": "TEST-GUIDE.md",
      "comments": [
        {
          "id": "1778517629104",
          "lineNumber": 130,
          "selectedText": "...",
          "text": "...",
          "createdAt": "2026-05-12T..."
        }
      ]
    }
  ]
}
```

### Migration Steps

1. **Backup your existing comments:**
   ```bash
   cp -r .clawdocu-comments .clawdocu-comments-backup
   ```

2. **Run the migration script:**
   ```bash
   node scripts/migrate-comments.mjs
   ```

3. **Verify the migration:**
   - Check that `.clawdocu/comments.json` exists
   - Verify all your comments are present
   - Test in ClawDocu UI

4. **Commit the changes:**
   ```bash
   git add .clawdocu/comments.json
   git rm -r .clawdocu-comments
   git commit -m "Migrate to single comments.json file"
   ```

### Manual Migration

If you prefer to migrate manually:

1. Create `.clawdocu/comments.json`
2. For each file in `.clawdocu-comments/`:
   - Read the JSON file
   - Add entry to `files` array with `path` and `comments`
3. Delete `.clawdocu-comments/` folder

### Need Help?

If you encounter issues during migration:
1. Check the console for error messages
2. Verify your JSON files are valid
3. Open an issue on GitHub with your error details
