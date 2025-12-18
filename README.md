# Tempus

Professional time tracking powered by Google Sheets and Apps Script.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Overview

Tempus is a sophisticated timesheet application that runs entirely within Google Sheets. It features a modern web interface for tracking time, managing contracts, generating invoices, and calculating income with full Australian tax and superannuation support.

For detailed usage guides and feature references, see `docs/README.md`.

## Features

### Time Tracking
- **Punch-based time entry** - Clock in/out with precise timestamps
- **Basic mode** - Quick entry for total hours worked
- **Advanced mode** - Multiple punch ranges per day
- **Entry defaults** - Save common time patterns for quick reuse
- **Calendar view** - Visual overview of time entries

### Contract Management
- **Billable contracts** - Track rates, date ranges, and project details
- **Income calculations** - Automatic gross/net income calculations
- **Annual reporting** - Comprehensive financial year summaries

### Australian Tax & Payroll
- **Tax calculations** - Accurate PAYG tax withholding
- **Superannuation** - Automatic super guarantee calculations with historical rate support
- **Deductions** - Track and manage tax deductions
- **BAS reporting** - Business Activity Statement generation with GST calculations
- **Invoice tracking** - Generate and manage invoices with automatic GST

### Customization
- **Feature flags** - Enable/disable features based on your needs
- **Themes** - Multiple color schemes including accessibility themes
- **Projects** - Organise time entries by project
- **Settings** - Extensive configuration options

### Performance
- **Aggressive caching** - Fast load times with server and client-side caching
- **Optimistic updates** - Immediate UI feedback with background sync

## Getting Started

### For Users (Quick Setup)

The easiest way to get started is to make a copy of the Tempus template:

**TODO: Add link to Google Sheet template**

1. **Copy the template** - Make a copy of the Tempus Google Sheet
2. **Deploy the web app**:
   - Click **Extensions** > **Apps Script**
   - Click **Deploy** > **Test deployments**
   - Click **Select type** > **Web app**
   - Set **Execute as**: "User accessing the web app"
   - Set **Who has access**: "Anyone"
   - Click **Deploy**
   - Copy and bookmark the URL
3. **Start tracking** - Open the web app URL and begin tracking your time!

### For Developers (Local Development)

If you want to modify Tempus or contribute to development:

#### Prerequisites

- [Node.js](https://nodejs.org/) (includes npm)
- [clasp](https://github.com/google/clasp) - Google Apps Script CLI tool
- Git (optional, but recommended)

#### Setup

> **Note**: All terminal commands in this section must be run in a Unix-like terminal:
> - **Windows**: Use Git Bash (or WSL)
> - **macOS/Linux**: Use the built-in Terminal

1. **Install clasp**:
   ```bash
   npm install -g @google/clasp
   ```

2. **Clone this repository**:
   ```bash
   git clone https://github.com/brandonhinds/tempus.git
   cd tempus
   ```

3. **Create a Google Sheet** with a bound Apps Script project, or copy the template (see link above)

4. **Login to clasp and connect to your Apps Script project**:
   ```bash
   clasp login
   ```
   **Important**: When prompted, make sure to allow **all requested permissions**. Clasp needs full access to manage your Apps Script projects.

   ```bash
   clasp clone [Your Script ID]
   ```

   Find your Script ID in Apps Script under **Project Settings**

5. **Push code to Apps Script**:
   ```bash
   clasp push
   ```

6. **Deploy the web app**:
   - In Apps Script Editor: **Deploy** > **Test deployments**
   - Click **Select type** > **Web app**
   - Set **Execute as**: "User accessing the web app"
   - Set **Who has access**: "Anyone"
   - Click **Deploy**

7. **Get your web app URL**:
   - In your Google Sheet: **Tempus** > **Get Web App URL**
   - Or copy it from the Test deployments screen

#### Development Workflow

After initial setup, your workflow is simple:

1. **Make changes** to files in your local repository
2. **Push updates**: `clasp push`
3. **Refresh the web app** - Changes appear automatically (test deployment auto-updates)

## Updating Tempus

> **Note**: All terminal commands in this section must be run in a Unix-like terminal:
> - **Windows**: Use Git Bash (or WSL)
> - **macOS/Linux**: Use the built-in Terminal

### For Users

If you copied the template and want to get the latest features:

1. **Backup your data** - Use the "Create Backup Now" button in the About page
2. **Download the latest version**:
   - Download [tempus-main.zip](https://github.com/brandonhinds/tempus/archive/refs/heads/main.zip)
   - Extract to your computer
3. **Authenticate with clasp** (first time only):
   ```bash
   clasp login
   ```
   **Important**: When prompted, make sure to allow **all requested permissions**. Clasp needs full access to manage your Apps Script projects.

4. **Update via clasp**:
   ```bash
   cd /path/to/extracted/tempus
   clasp push
   ```

   > **Troubleshooting**: If you get an "Insufficient Permission" error, clasp likely needs additional permissions. Run `clasp login` again and ensure you grant all requested permissions.

5. **Refresh your web app** - Changes appear immediately

### For Developers

If you cloned the repository with Git:

```bash
cd /path/to/tempus
git pull origin main
clasp push
```

> **Troubleshooting**: If you get an "Insufficient Permission" error during `clasp push`, run `clasp login` again and ensure you grant all requested permissions.

After cloning, point your repository hooks at the bundled scripts so build metadata stays up to date:
```bash
git config core.hooksPath .githooks
```
The pre-commit hook runs `scripts/write-version.sh`, which stamps `backend/version.gs` with the current UTC build date before every commit.

## Sharing Access

To share Tempus with a partner or team member:

1. **Share your Google Sheet** with them (Editor or Viewer access)
2. **Give them the web app URL** (Tempus menu > Get Web App URL)
3. **Ensure deployment permissions** allow access:
   - Apps Script: **Deploy** > **Manage deployments** > **Edit**
   - Set **Who has access** to "Anyone"

**Note**: Everyone accesses the same data. There are no per-user permissions within Tempus itself.

## Support / Feature Requests

Raise an [issue](https://github.com/brandonhinds/tempus/issues) for bugs or feature requests.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License. You are free to use, modify, and distribute this software. See the [LICENSE](license.md) file for details.

## Acknowledgments

Created by [Brandon Hinds](https://github.com/brandonhinds)

Support continued development: [ko-fi.com/brandonhinds](https://ko-fi.com/brandonhinds)

---

**Tempus** - Professional time tracking, powered by Google Sheets
