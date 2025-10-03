The next things we want to include:

- Add alternative views to hours, such as weekly and fortnightly (feature flag)

- Add the ability to add salary sacrifice options, as well as a novated lease.

- Have a configurable number of hours that can be tracked, with the default one being work. Have the ability to have multiple "work" hours. If there is more than one type of hours then have a dropdown that displays all the choices, defaulting to work.
    * Have this behind a feature flag

- Add a contract burndown view that can be loaded for a selected contract

- Assuming the contracts page gets expanded views, move the new contract settings to a button instead of always being at the bottom of the screen

- Add the invoice requirements (all behind feature flags)

- Add a thinkStack employee feature flag, which will do things like include the lost super in the expected pay

- Add BAS tracking
    * Enable both monthly and quarterly payments

- Add ability to switch months using a date picker (with just months and years)

- Add ability to add actual pay for comparison

- Remove the Reset button on the timer.

- Rework the timer to instead be a punch in/punch out system, or at the very least store the start of the timer in local storage so a browser refresh doesn't blow it away.

- Add the concept of "default inputs", which can allow a user to configure quick select hours options. This would be helpful for both James Bustard, who does consistent hours each day, and Lil, who has different types of assessments that her income is based off.

- Update some settings to force a cache flush when enabled or updated (e.g the superannuation percentage)

- Remove the New Entry button from the entries list at the bottom of the sheet.

- Have a new, basic time entry mode where someone just puts in the total hours. In this mode double clicking on a calendar cell would allow the entry to be directly edited there. This mode would need to be feature flagged because it would be incompatible with the other data entry methods.