# Time Entry

## Purpose

The desktop day editor brings every record for one date into a single reconciliation view. It keeps clock-based work, fixed-duration records and day-level context distinct while showing one authoritative overall total.

## Accessing the Day Editor

Open **Time Entry**, choose Calendar or Agenda, then select a day. An ordinary day selection opens the complete day. Selecting a specific Calendar entry marker may also expand that unique record automatically. The dedicated mobile entry flow is unchanged.

## Timed Sessions

Timed Sessions appear first and are ordered chronologically. The section total includes completed session time, while inferred or stored gaps are shown as breaks. Open sessions display as open and keep the total provisional.

Select a session row to edit its start, end, hour type or contract. Use **Add session** for another timed period, or the clock action to start or finish work now. New sessions only offer hour types and contracts currently configured for Detailed entry. Historical sessions remain editable when configuration changes later.

Times accept 24-hour input such as `17:30` or `1730`, as well as `5:30pm`. Without AM/PM, times use the preceding session or start time as context: `9` then `5` becomes 9am–5pm. You can pause while typing; unfinished text stays in the field until you finish it.

Session additions, time edits, hour type or contract changes, and deletions remain unsaved as you move between rows. Click **Save** or press **Enter** to save the complete batch. **Cancel** discards the batch. A failed save keeps your draft available to retry. Clock in/out remain immediate actions.

## Duration Entries

Duration Entries list each fixed-duration record separately with its hour type, contract context, billable state and duration. The heading total covers only these records.

Select a row to expand its editor. **Save changes** updates that exact record, **Cancel** restores the saved values, and **Delete** removes only that record. Use **Add duration entry** to create another fixed amount. New entries only offer Simple-compatible configuration; historical records remain accessible.

One row editor is expanded at a time; session changes remain buffered when switching between session rows. Switching between the session and duration sections prompts you to save or discard unsaved changes. Closing the day editor also requires confirmation before unsaved work is discarded.

## Day Details

Comments and copy-previous-day actions appear after both time sections because they affect the whole day. The overall total at the top combines Timed Sessions and Duration Entries; breaks are reported separately and are not added to logged time.

## Tips

- Use an ordinary day selection when reconciling a mixed day containing both work sessions and leave durations.
- Leave the end time blank only when a session is genuinely still running.
- Check the section totals before the overall total when investigating a discrepancy.
