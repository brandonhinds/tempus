# Updates

How to check for updates and deploy new versions of Tempus to your Google Apps Script project.

## Purpose
Tempus is actively developed with regular improvements, bug fixes, and new features. The update system helps you stay current with the latest version by checking for newer builds and providing clear deployment instructions.

## Checking for Updates

### Update Indicator
The About page automatically checks for updates when you open it:

1. Navigate to About from the main menu.
2. Look for the "Version" section near the top.
3. The status indicator shows:
   - **Up to date** (green): Your build matches the latest available version.
   - **Update available** (orange): A newer build exists; shows the date it was published.
   - **Status unavailable** (grey/red): Unable to check for updates (network issue or repository unavailable).

### What Gets Checked
- Your current build displays the date your version was compiled (e.g., "Build date 2025-01-15").
- The system compares this against the upstream repository to detect if a newer build exists.
- If an update is available, you'll see when it was released.

## Updating Tempus

The easiest and most reliable way to update is using the provided update script, which automatically downloads the latest code and pushes it to your Apps Script project.

### Prerequisites
- Node.js and npm installed (for clasp).
- clasp configured and authenticated with your Google account (`clasp login`).
- Your Apps Script project ID (found in the Apps Script editor under Project Settings).

### Recommended: Using the Update Script

This is the **easiest and most reliable** update method. The About page generates the complete command for you:

1. **Navigate to the About page** in Tempus (from the main menu).

2. **Expand the "Updating Tempus" section** and click the **Automated** tab.

3. **Copy and run the command** shown in the code block.

   The command is pre-filled with your Apps Script project ID and will:
   - Download the update script
   - Make it executable
   - Clone your Apps Script project
   - Download the latest Tempus code from GitHub
   - Push the update to your project
   - Clean up temporary files automatically

4. **Refresh your browser**
   - Close any open Tempus tabs.
   - Open the web app URL again to load the new version.
   - Check the About page to confirm your build date has updated.

### Alternative: Manual Update (if you have the repo cloned)

If you already have the Tempus repository cloned locally:

1. **Navigate to your local Tempus directory**
   ```bash
   cd /path/to/tempus
   ```

2. **Pull the latest code**
   ```bash
   git pull origin main
   ```

3. **Push to Google Apps Script**
   ```bash
   clasp push
   ```

4. **Refresh your browser**
   - Close any open Tempus tabs and reload the web app URL.
   - Check the About page to confirm the new build date.

## Update Frequency

Tempus receives updates regularly:

- **Bug fixes**: Released as soon as issues are resolved.
- **New features**: Typically bundled into periodic releases.
- **Documentation**: Updated continuously as features evolve.

Check the About page monthly, or whenever you notice "Update available" indicators, to stay current.

## What Changes in Updates

### Typical Updates Include
- **New features**: Additional functionality and capabilities.
- **Bug fixes**: Resolved issues and improved stability.
- **Performance improvements**: Faster loads and smoother interactions.
- **UI enhancements**: Better layouts, accessibility, and mobile support.
- **Documentation**: Updated guides and help text.

### What Doesn't Change
- **Your data**: All Google Sheets data remains unchanged during updates.
- **Settings**: Your preferences, feature flags, and configurations are preserved.
- **Cache**: Local browser cache continues working (unless a major data structure change requires clearing).

## Troubleshooting Updates

### Update Script Fails
- **clasp not found**: Install clasp with `npm install -g @google/clasp`.
- **Not authenticated**: Run `clasp login` to authenticate with your Google account.
- **Invalid script ID**: Verify your Apps Script project ID in the Apps Script editor (Project Settings).
- **Permission denied**: Ensure you have edit access to the Apps Script project.
- **curl/tar not found**: Install curl and tar (usually pre-installed on Mac/Linux; use Git Bash on Windows).

### Update Won't Apply (Manual Method)
- Ensure you ran `git pull` successfully (check for merge conflicts).
- Verify `clasp push` completed without errors.
- Try a hard refresh in your browser (Ctrl+Shift+R or Cmd+Shift+R).
- Clear your browser cache if the old version persists.

### Version Still Shows Old Date
- The update script automatically handles versioning.
- For manual updates: run `./scripts/write-version.sh` before `clasp push`.
- Check that `backend/version.gs` shows the current date.
- Re-run `clasp push` after updating the version file.

### Build Date Missing
- The update script should automatically generate the version file.
- For manual updates: run `./scripts/write-version.sh` to generate it.
- Ensure the `backend/version.gs` file exists and contains a valid `BUILD_DATE` value.

## Tips
- **Use the About page** - The Automated tab generates the complete update command with your project ID pre-filled.
- **Always create a backup** - Use the "Create Backup Now" button on the About page before updating.
- Copy the command from the About page and run it in your terminal - that's all you need to do.
- Subscribe to repository notifications to get alerted about new releases.
- Read release notes (if available) before updating to understand what changed.
- Updates are optional - only update when you need new features or fixes.
- Test updates on a copy of your spreadsheet first if you're concerned about compatibility.
- The script uses `clasp push -f` (force) to ensure all files update, even if timestamps are stale.

## Summary

Update Tempus by pulling the latest code and pushing to Apps Script. Use the automated update command from the About page, create a backup first, and clear cache after updating to ensure changes take effect.
