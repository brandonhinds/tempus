/**
 * Monthly split of received money into the business account (obligations) and the offset (her income).
 *
 * Sole trader, so there is no separate entity: business income IS personal income, tax applies to profit
 * rather than revenue, and GST collected is money held for the ATO rather than earnings. Super is treated
 * as an obligation here by choice — there is no Super Guarantee owed to yourself, but paying it anyway
 * keeps super from falling behind, and because a personal contribution is deductible it is subtracted
 * before the tax provision.
 *
 * Order of operations for each month, on a cash basis by default:
 *
 *   1. received_ex_gst      = money in, less the GST portion of it
 *   2. expenses_ex_gst      = business costs paid, less their claimable GST credits
 *   3. profit_before_super  = 1 - 2
 *   4. super                = super guarantee rate x 3
 *   5. taxable_profit       = 3 - 4          (super is deductible)
 *   6. tax                  = instalment-rate method, else cumulative year-to-date
 *   7. net_gst              = GST on sales - GST credits on purchases   (negative = refund)
 *   8. to_business_account  = 7 + 6 + 4
 *   9. to_offset            = money in - 8 - business costs paid
 *
 * Which reduces to `to_offset === taxable_profit - tax`: her after-tax income. That identity is asserted
 * per month and for the year in the tests, and is the quickest way to see the split has not sprung a leak.
 */
var TRANSFER_SPLIT_FY_MONTH_ORDER = [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5];

function transferSplitMonthLabel_(calendarMonth, calendarYear) {
  var date = new Date(Date.UTC(calendarYear, calendarMonth, 1, 12));
  return Utilities.formatDate(date, 'UTC', 'MMM yyyy');
}

function transferSplitQuarterForMonth_(calendarMonth) {
  return Math.floor(((calendarMonth + 6) % 12) / 3) + 1;
}

/**
 * @param {{financial_year:number, accounting_basis:string}} payload
 */
function api_getMonthlyTransferSplit(payload) {
  var financialYear = Number(payload && payload.financial_year);
  if (!isFinite(financialYear)) throw new Error('Financial year is required.');
  var basis = payload && payload.accounting_basis === 'accrual' ? 'accrual' : 'cash';
  var instalmentRate = resolvePaygInstalmentRate_();

  var months = [];
  var ytdTaxableProfit = 0;
  var provisionedTax = 0;
  var totals = {
    received: 0, received_ex_gst: 0, gst_on_sales: 0, expenses_paid: 0, expenses_ex_gst: 0,
    gst_on_purchases: 0, net_gst: 0, super: 0, tax: 0, to_business_account: 0, to_offset: 0,
    profit_before_super: 0, taxable_profit: 0
  };
  var warnings = [];

  TRANSFER_SPLIT_FY_MONTH_ORDER.forEach(function(calendarMonth, position) {
    var range = basPeriodRange_({ financial_year: financialYear, period_type: 'monthly', month: calendarMonth });
    var actuals = basActualsForRange_(basis, range.from, range.to);

    var received = actuals.g1_total_sales;
    var gstOnSales = actuals.gst_on_sales;
    var receivedExGst = roundMoney_(received - gstOnSales);
    var expensesPaid = actuals.purchases;
    var gstOnPurchases = actuals.gst_on_purchases;
    var expensesExGst = roundMoney_(expensesPaid - gstOnPurchases);

    var profitBeforeSuper = roundMoney_(receivedExGst - expensesExGst);
    var superRate = getSuperGuaranteeRate(range.from);
    var superAmount = roundMoney_(Math.max(0, profitBeforeSuper) * superRate);
    var taxableProfit = roundMoney_(profitBeforeSuper - superAmount);

    ytdTaxableProfit = roundMoney_(ytdTaxableProfit + taxableProfit);
    var provision = soleTraderTaxProvision_({
      instalment_rate: instalmentRate,
      period_instalment_income: receivedExGst,
      ytd_taxable_profit: ytdTaxableProfit,
      months_elapsed: position + 1,
      already_provisioned: provisionedTax,
      financial_year: financialYear
    });
    provisionedTax = roundMoney_(provisionedTax + provision.amount);

    var netGst = roundMoney_(gstOnSales - gstOnPurchases);
    var toBusinessAccount = roundMoney_(netGst + provision.amount + superAmount);
    var toOffset = roundMoney_(received - toBusinessAccount - expensesPaid);

    if (provision.warning && warnings.indexOf(provision.warning) === -1) warnings.push(provision.warning);

    var calendarYear = calendarMonth >= 6 ? financialYear : financialYear + 1;
    months.push({
      calendar_month: calendarMonth,
      calendar_year: calendarYear,
      financial_month_position: position + 1,
      label: transferSplitMonthLabel_(calendarMonth, calendarYear),
      bas_quarter: transferSplitQuarterForMonth_(calendarMonth),
      period: range,
      received: received,
      received_ex_gst: receivedExGst,
      gst_on_sales: gstOnSales,
      expenses_paid: expensesPaid,
      expenses_ex_gst: expensesExGst,
      gst_on_purchases: gstOnPurchases,
      net_gst: netGst,
      profit_before_super: profitBeforeSuper,
      super_rate: superRate,
      super: superAmount,
      taxable_profit: taxableProfit,
      tax: provision.amount,
      tax_method: provision.method,
      tax_detail: provision,
      to_business_account: toBusinessAccount,
      to_offset: toOffset
    });

    totals.received = roundMoney_(totals.received + received);
    totals.received_ex_gst = roundMoney_(totals.received_ex_gst + receivedExGst);
    totals.gst_on_sales = roundMoney_(totals.gst_on_sales + gstOnSales);
    totals.expenses_paid = roundMoney_(totals.expenses_paid + expensesPaid);
    totals.expenses_ex_gst = roundMoney_(totals.expenses_ex_gst + expensesExGst);
    totals.gst_on_purchases = roundMoney_(totals.gst_on_purchases + gstOnPurchases);
    totals.net_gst = roundMoney_(totals.net_gst + netGst);
    totals.profit_before_super = roundMoney_(totals.profit_before_super + profitBeforeSuper);
    totals.super = roundMoney_(totals.super + superAmount);
    totals.taxable_profit = roundMoney_(totals.taxable_profit + taxableProfit);
    totals.tax = roundMoney_(totals.tax + provision.amount);
    totals.to_business_account = roundMoney_(totals.to_business_account + toBusinessAccount);
    totals.to_offset = roundMoney_(totals.to_offset + toOffset);
  });

  if (!instalmentRate) {
    warnings.push('No PAYG instalment rate is set, so tax is estimated from year-to-date profit. Set payg_instalment_rate, or lodge a BAS carrying a T2 rate, for a figure that matches what the ATO asks you to pay.');
  }

  return {
    success: true,
    financial_year: financialYear,
    accounting_basis: basis,
    tax_method: instalmentRate ? 'instalment_rate' : 'cumulative',
    instalment_rate: instalmentRate,
    tax_table: api_getIndividualTaxTableStatus(financialYear),
    months: months,
    totals: totals,
    warnings: warnings
  };
}

function api_exportMonthlyTransferSplitCsv(payload) {
  var report = api_getMonthlyTransferSplit(payload);
  var rows = [[
    'Month', 'BAS quarter', 'Money in (incl GST)', 'GST on sales', 'Business costs paid (incl GST)',
    'GST credits', 'Net GST', 'Super', 'Tax provision', 'Tax method',
    'To business account', 'To offset'
  ]];
  report.months.forEach(function(month) {
    rows.push([
      month.label, 'Q' + month.bas_quarter, month.received, month.gst_on_sales, month.expenses_paid,
      month.gst_on_purchases, month.net_gst, month.super, month.tax, month.tax_method,
      month.to_business_account, month.to_offset
    ]);
  });
  rows.push([
    'Total', '', report.totals.received, report.totals.gst_on_sales, report.totals.expenses_paid,
    report.totals.gst_on_purchases, report.totals.net_gst, report.totals.super, report.totals.tax, '',
    report.totals.to_business_account, report.totals.to_offset
  ]);
  return {
    success: true,
    filename: 'tempus-transfer-split-fy' + financialYearLabelSlug_(report.financial_year) + '.csv',
    csv: rows.map(function(row) { return row.map(csvSafeCell_).join(','); }).join('\r\n')
  };
}
