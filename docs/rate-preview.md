# Rate Preview

Model hypothetical hourly rate changes and see their impact on your contract earnings, superannuation, tax, and net income.

## Purpose
The Rate Preview feature lets you explore "what if" scenarios for hourly rate changes without modifying your actual contract data. Whether you're negotiating a pay rise, considering a contract renewal, or just curious about the financial impact of different rates, Rate Preview shows you exactly how much more (or less) you would have earned at a different hourly rate.

**Important:** Rate Preview is a read-only sandbox. It calculates hypothetical scenarios based on your existing time entries but doesn't change any stored data. Use it for planning and negotiation, then update your actual contract rates when you're ready to commit.

**Bonus:** There's a satisfying dopamine hit from seeing big numbers when you model a generous pay rise. Enjoy it responsibly.

## Enabling Rate Preview

**Requires:** *Enable contract rate preview page* feature flag

1. Navigate to **Settings**.
2. Scroll to the **Feature Flags** section.
3. Expand the **Income** group.
4. Enable *Enable contract rate preview page*.
5. Click **Save Settings**.
6. The **Rate Preview** option appears in the main navigation menu.

## Accessing Rate Preview

1. Open the main navigation menu (☰ in the header).
2. Select **Rate Preview**.
3. The Rate Preview page opens with an empty state prompting you to select a contract.

## Modelling a Rate Change

### Step 1: Select a Contract

1. Use the **Contract** dropdown to select the contract you want to model.
2. The current hourly rate appears in the **New hourly rate** input field.
3. The page remains in empty state until you adjust the rate.

**Note:** Only contracts with time entries will show meaningful data. If you select a contract with no logged hours, the calculations will all be zero.

### Step 2: Enter a New Rate

You can specify rate changes in two ways:

#### Option 1: Percentage Change
Enter a percentage in the **Rate change (%)** field:
- **Positive values** = pay rise (e.g., `5` for a 5% increase)
- **Negative values** = pay cut (e.g., `-10` for a 10% decrease)
- The **New hourly rate** field updates automatically to reflect the calculated rate

**Example:** Your current rate is $100/hr. Enter `10` in the percentage field, and the new rate becomes $110/hr.

#### Option 2: Absolute Rate
Enter a specific hourly rate in the **New hourly rate** field:
- Type any dollar amount (e.g., `120`)
- The **Rate change (%)** field updates automatically to show the percentage difference

**Example:** Your current rate is $100/hr. Enter `120` in the new rate field, and the percentage field shows `20%`.

**Bidirectional Sync:** The two input fields stay in sync. Change one, and the other updates automatically. Use whichever method feels more natural for your scenario.

### Step 3: Review the Impact

As soon as you enter a new rate, the page displays three summary cards and a monthly breakdown table:

## Understanding the Summary Cards

### Card 1: Hourly Rate
Shows the adjusted rate you've entered and the variance from your current rate.

**What you'll see:**
- **Adjusted rate**: The new hourly rate you're modelling (e.g., $110 / hr)
- **Current rate**: Your actual contract rate (e.g., $100 / hr)
- **Variance**: The difference in dollars and percentage (e.g., +$10 / hr)
- **Hours logged**: Total hours you've worked on this contract to date

**Use this to:** Confirm the rate you're modelling and see the per-hour difference.

### Card 2: Earnings to Date
Shows what you would have earned at the new rate for all hours already logged, compared to what you actually earned.

**What you'll see:**
- **Scenario earnings**: Total you would have earned at the new rate
- **Current earnings**: Total you actually earned at the current rate
- **Variance**: The difference (e.g., +$5,000 or -$2,000)
- **Superannuation**, **Tax**, and **Net income** breakdowns with variances

**Use this to:** Understand the retrospective impact. If you'd started at the new rate from day one of this contract, this is how much more (or less) you would have earned so far.

**Dopamine moment:** This is where you see the big numbers. A 10% pay rise on a contract with 500 hours logged can show a variance of $5,000+. Enjoy the "what could have been" feeling.

### Card 3: Total Possible Potential (Capped Contracts Only)
For contracts with hour caps, shows what you could still earn for the remaining hours at the new rate.

**What you'll see:**
- **Scenario remaining**: What you'd earn for remaining hours at the new rate
- **Current remaining**: What you'll earn at the current rate
- **Total contract hours**: Remaining hours available
- **Variance**: The future opportunity difference
- **Superannuation**, **Tax**, and **Net income** projections with variances

**Use this to:** Evaluate the forward-looking impact. If you negotiate a rate increase today, this card shows how much more you'll earn for the rest of the contract.

**Note:** This card only appears for contracts with hour caps (contracts where you've set a **Total Hours** limit). Ongoing contracts (no hour cap) don't show this card since there's no defined "remaining" hours.

## Understanding the Monthly Breakdown Table

Below the summary cards, a table shows month-by-month comparisons:

**Columns:**
- **Month**: The calendar month
- **Hours**: Hours you logged in that month
- **Gross**: Earnings before super/tax (scenario vs current, with variance)
- **Super**: Superannuation contributions (scenario vs current, with variance)
- **Tax**: Tax withholding (scenario vs current, with variance)
- **Net**: Net income after super/tax (scenario vs current, with variance)

**Each cell shows:**
- **Scenario value** (top, in bold)
- **Current value** (below, in muted text)
- **Variance** (colour-coded: green for positive, red for negative)

**Use this to:** Identify which months would have been most affected by the rate change. Months with more hours show larger variances.

## Rate Change Methods

### Method 1: Modelling a Pay Rise
**Use case:** Negotiating a rate increase or planning a contract renewal.

**Example workflow:**
1. Select your current contract
2. Enter `15` in the **Rate change (%)** field to model a 15% pay rise
3. Review the **Earnings to Date** card to see what you would have earned so far
4. Review the **Total Possible Potential** card (if applicable) to see what you could earn going forward
5. Use these figures in your negotiation

**Dopamine hit:** The bigger the percentage and the more hours logged, the more satisfying the variance numbers. A 20% rise on a contract with 1,000 hours can show five-figure variances.

### Method 2: Comparing Specific Rates
**Use case:** Choosing between two job offers or contract options.

**Example workflow:**
1. Select the contract you want to compare
2. Enter the competing rate in the **New hourly rate** field (e.g., `135` if another contract offers $135/hr)
3. Compare the **Net income** variance to see the real take-home difference after super and tax
4. Use the monthly breakdown to understand the impact over time

**Insight:** Tax withholding increases as rates go up, so the net income variance is often smaller than you'd expect. Rate Preview shows you the real numbers.

### Method 3: Evaluating a Pay Cut
**Use case:** Considering a role with better conditions but lower pay, or switching to part-time.

**Example workflow:**
1. Select your current contract
2. Enter a negative percentage (e.g., `-25`) or a lower absolute rate
3. Review the **Net income** variance to see how much less you'd take home
4. Use the monthly breakdown to budget for the change

**Note:** Negative variances appear in red. This feature works just as well for pay cuts as it does for pay rises - the maths is the same.

### Method 4: Exploring Extreme Scenarios
**Use case:** Pure curiosity or motivational planning.

**Example workflow:**
1. Select any contract
2. Enter an aspirational rate (e.g., double your current rate)
3. Watch the variances climb
4. Use it as motivation to upskill or negotiate harder

**Fun fact:** This is where the dopamine hit is strongest. Seeing what you *could* have earned at 2x your current rate is both inspiring and slightly depressing.

## How Calculations Work

### Rate as Total Package
Contract rates in Tempus represent your **total package**, including employer superannuation. Rate Preview maintains this convention.

**Example:**
- Your contract rate is $115/hr total package
- Superannuation guarantee is 11.5%
- **Gross income** = $115 ÷ 1.115 = $103.14/hr (the employer removes super before paying you)
- **Super contribution** = $103.14 × 0.115 = $11.86/hr
- **Tax** is calculated on the gross income using your configured tax rate type
- **Net income** = Gross - Tax

This matches the income calculations shown on the Dashboard and ensures Rate Preview reflects your real take-home pay.

### Tax Calculations
Tax withholding uses the Australian tax tables configured in your settings:
- Tax rate type (weekly, fortnightly, monthly) determines which table applies
- Tax-free threshold setting affects calculations
- Extra super and deductions (if configured) are factored in

**Important:** Tax calculations are estimates based on withholding tables. Your actual tax liability may differ at tax time depending on your total annual income and deductions.

### Variance Calculations
All variance values show:
- **Absolute difference**: Dollar amount (e.g., +$5,000)
- **Percentage difference**: Relative change (e.g., +10%)

**Colour coding:**
- **Green**: Positive variance (more money in scenario)
- **Red**: Negative variance (less money in scenario)
- **Tax variance is inverted**: Less tax = green (good), more tax = red (though tax increases are often inevitable with higher earnings)

## Tips for Using Rate Preview

- **Model before negotiating**: Use Rate Preview before entering salary negotiations to understand what different percentage increases mean in real dollars.
- **Compare net, not gross**: Focus on the **Net income** variance when comparing options. Gross income differences can be misleading once super and tax are factored in.
- **Check the monthly breakdown**: Some months with high hours show much larger variances. This can help you understand seasonal income variations.
- **Use the Reset button**: Click **Reset** to return to the current contract rate and start a fresh comparison.
- **Model multiple contracts**: Switch between contracts to compare the impact of the same percentage increase across different engagements.
- **Understand hour caps**: For capped contracts, the **Total Possible Potential** card shows your future earning opportunity. For ongoing contracts, focus on the **Earnings to Date** card.
- **Dopamine management**: Seeing big "what if" numbers can be motivating or discouraging depending on your situation. Use it constructively for planning, not regret.
- **No data saved**: Rate Preview never changes your actual contract data. Close the page and your contracts remain unchanged. Only use the Contracts page to update real rates.
- **Combine with contract history**: If you update a contract rate, use Rate Preview on the old rate first to document what the change represents.
- **Tax impact**: Higher rates = more tax. Rate Preview shows you exactly how much more tax you'd pay, which is often surprising.
- **Round numbers work**: Don't stress over precise percentages. Round numbers like 5%, 10%, or 15% are fine for modelling - you can always refine later.

## Common Rate Preview Questions

### Does Rate Preview change my contract data?
No. Rate Preview is completely read-only. It calculates hypothetical scenarios without touching your actual contract rates or time entries.

### Why does the net income variance seem smaller than expected?
Tax. As your gross income increases, so does your tax withholding. A 10% pay rise might only translate to a 7-8% increase in net income after the additional tax is deducted.

### Can I model rate changes for contracts with no time entries?
Technically yes, but the results will all be zero since there are no hours to calculate against. Rate Preview is most useful for contracts with logged time.

### Why don't I see the Total Possible Potential card?
This card only appears for contracts with hour caps (contracts where you've set a **Total Hours** limit). Ongoing contracts have no defined remaining hours, so this card is hidden.

### Can I model rate decreases?
Yes. Enter negative percentages (e.g., `-10`) or a lower absolute rate. The variances will be negative (shown in red), but the calculations work the same way.

### Can I compare multiple rates side-by-side?
Not directly. Rate Preview shows one scenario at a time. To compare multiple rates, write down the variances for each scenario or take screenshots.

## Summary

Rate Preview is your financial what-if calculator. Model pay rises, compare job offers, evaluate pay cuts, or just explore extreme scenarios for motivation. The calculations factor in super and tax to show you real net income differences, not just gross figures. Use it to plan negotiations, budget for career changes, or simply enjoy the dopamine hit of seeing what you could have earned at a higher rate. Just remember: it's a sandbox - nothing changes until you update your actual contract rates.

For contract management, see [Contracts documentation](contracts.md).
