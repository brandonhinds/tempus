function estimateTax(grossIncome, currentDate) {
  // Add one cent if the income ends in 33 cents
  if ((grossIncome % 1).toFixed(2) == 0.33) {
    grossIncome = grossIncome + 0.01
  }
  var weeklyIncome = Math.floor(grossIncome * (3/13)) + 0.99
  Logger.log("weeklyIncome = " + weeklyIncome)

  // Convert currentDate to a Date object
  var date = new Date(currentDate);

  // Determine the financial year
  // Note: The date checked is end of May, rather than end of June, because your June pay will be paid in the new financial year
  var financialYear;
  switch (true) {
    case (date <= new Date('2024-05-30')):
      financialYear = '2020/2021';
      break;
    case (date <= new Date('2099-05-30')):
      financialYear = '2024/2025';
      break;
    default:
      throw new Error('Date out of range');
  }

  // Note: Pay scales come from Scale 2 in the following link:
  // https://www.ato.gov.au/Rates/Schedule-1---Statement-of-formulas-for-calculating-amounts-to-be-withheld/

  // Determine the values of a and b based on the financial year and weekly income
  switch (financialYear) {
    case '2020/2021':
      switch (true) {
        case (weeklyIncome < 359):
          a = 0;
          b = 0;
          break;
        case (weeklyIncome < 438):
          a = 0.1900;
          b = 68.3462;
          break;
        case (weeklyIncome < 548):
          a = 0.2900;
          b = 112.1942;
          break;
        case (weeklyIncome < 721):
          a = 0.2100;
          b = 68.3465;
          break;
        case (weeklyIncome < 865):
          a = 0.2190;
          b = 74.8369;
          break;
        case (weeklyIncome < 1282):
          a = 0.3477;
          b = 186.2119;
          break;
        case (weeklyIncome < 2307):
          a = 0.3450;
          b = 182.7504;
          break;
        case (weeklyIncome < 3461):
          a = 0.3900;
          b = 286.5965;
          break;
        default:
          a = 0.4700;
          b = 563.5196;
      }
      break;

    case '2024/2025':
      switch (true) {
        case (weeklyIncome < 361):
          a = 0;
          b = 0;
          break;
        case (weeklyIncome < 500):
          a = 0.1600;
          b = 57.8462;
          break;
        case (weeklyIncome < 625):
          a = 0.2600;
          b = 107.8462;
          break;
        case (weeklyIncome < 721):
          a = 0.1800;
          b = 57.8462;
          break;
        case (weeklyIncome < 865):
          a = 0.1890;
          b = 64.3365;
          break;
        case (weeklyIncome < 1282):
          a = 0.3277;
          b = 180.0385;
          break;
        case (weeklyIncome < 2596):
          a = 0.3200;
          b = 176.5769;
          break;
        case (weeklyIncome < 3653):
          a = 0.3900;
          b = 358.3077;
          break;
        default:
          a = 0.4700;
          b = 650.6154;
      }
      break;

    default:
      throw new Error('Financial year not handled');
  }
  
  // Calculate tax
  var weeklyTax = (a * weeklyIncome) - b
  var monthlyTax = Math.round(weeklyTax * (13/3))
  Logger.log("monthlyTax = " + monthlyTax)

  // Calculate medicare levy
  // ** Note - commented out for now, to line numbers up with payslip
  // var medicareLevy = grossIncome * 0.02
  var medicareLevy = 0
  Logger.log("medicareLevy = " + medicareLevy)

  // Calculate HELP
  // Check if HELP debt has been repaid
  helpDebt = false
  var helpRepayment = 0
  if (helpDebt) {
    // SET THIS VALUE TO THE APPROPRIATE CONFIG VALUE IN THE SHEET
    var finishedHelpDate = new Date(SpreadsheetApp.getActive().getRange("Config!B14").getValues())
    finishedHelpDate.setDate(finishedHelpDate.getDate() - 1);
    Logger.log("finshedHelpDate = " + finishedHelpDate)
    Logger.log("currentDate = " + currentDate)
    if (finishedHelpDate.toString() == "Invalid Date" || currentDate < finishedHelpDate) {
      helpRepayment = estimateHELP(grossIncome)
    }
  }
  Logger.log("helpRepayment = " + helpRepayment)

  // Return total tax
  var totalMonthlyTax = monthlyTax + medicareLevy + helpRepayment
  Logger.log("totalMonthlyTax = " + totalMonthlyTax)
  return totalMonthlyTax
}

function estimateHELP(grossIncome) {
  var weeklyIncome = Math.floor(grossIncome * (3/13)) + 0.99
  Logger.log("weeklyIncome = " + weeklyIncome)

  // Note: Pay scales come from the following link:
  // https://www.ato.gov.au/Rates/Schedule-8---Statement-of-formulas-for-calculating-HELP,-SSL,-TSL-and-SFSS-components/
  var a = 0
  if (weeklyIncome < 903.99) { a = 0 } else
  if (weeklyIncome < 1042.99) { a = 0.010 } else
  if (weeklyIncome < 1105.99) { a = 0.020 } else
  if (weeklyIncome < 1171.99) { a = 0.025 } else
  if (weeklyIncome < 1242.99) { a = 0.030 } else
  if (weeklyIncome < 1316.99) { a = 0.035 } else
  if (weeklyIncome < 1395.99) { a = 0.040 } else
  if (weeklyIncome < 1479.99) { a = 0.045 } else
  if (weeklyIncome < 1568.99) { a = 0.050 } else
  if (weeklyIncome < 1662.99) { a = 0.055 } else
  if (weeklyIncome < 1762.99) { a = 0.060 } else
  if (weeklyIncome < 1868.99) { a = 0.065 } else
  if (weeklyIncome < 1980.99) { a = 0.070 } else
  if (weeklyIncome < 2099.99) { a = 0.075 } else
  if (weeklyIncome < 2223.99) { a = 0.080 } else
  if (weeklyIncome < 2359.99) { a = 0.085 } else
  if (weeklyIncome < 2500.99) { a = 0.090 } else
  if (weeklyIncome < 2650.99) { a = 0.095 } else
  { a = 0.100 }
  
  // Calculate HELP repayment
  var weeklyHELP = a * weeklyIncome
  var monthlyHELP = Math.round(weeklyHELP * (13/3))
  Logger.log("monthlyHELP = " + monthlyHELP)
  return monthlyHELP
}

function presentXeroFormat() {
  var sheet = SpreadsheetApp.getActiveSheet()
  var sheetDate = sheet.getRange(1,2).getValue()
  var monthYearNum = Utilities.formatDate(sheetDate, "Australia/Canberra", "MM-YYYY")
  var dateRows = [3, 9, 15, 21, 27, 33]
  var dateCols = [2, 3, 4, 5, 6, 7, 8]
  var dateResults = []
  var hourResults = []
  var htmlOutput = '<table style="margin-left:auto;margin-right:auto;border-spacing: 5px;">'
  var htmlDateRow = '<tr>'
  var htmlHourRow = '<tr>'

  // For each date row/col, if it has a value append date and corresponding hours worked to the relevant array
  dateRows.forEach(function(row) {
    dateCols.forEach(function(col) {
      // Get the date and hour values
      var dateValue = new Date(sheet.getRange(row, col).getValue())
      var hourValue = sheet.getRange(row + 1, col).getValue() || 0

      // This check is to avoid all the hidden/blank cells from contributing to the output
      if (Utilities.formatDate(dateValue, "Australia/Canberra", "MM-YYYY") == monthYearNum) {
        dateResults.push(Utilities.formatDate(dateValue, "Australia/Canberra", "dd MMM"))
        hourResults.push(hourValue.toFixed(2))
      }
    })
  })

  // Send message box with Xero formatting
  for (let i = 0; i < dateResults.length; i++) {
    if ([7,14,21,28].includes(i)) {
      // Finish rows
      htmlDateRow = htmlDateRow + '</tr>'
      htmlHourRow = htmlHourRow + '</tr>'

      // Push rows to htmlOutput
      htmlOutput = htmlOutput + htmlDateRow + htmlHourRow + "<td><br /></td>"

      // Reset rows
      htmlDateRow = '<tr>'
      htmlHourRow = '<tr>'
    }
    
    htmlDateRow = htmlDateRow + '<td style="text-align:center">' + dateResults[i] + '</td>'
    htmlHourRow = htmlHourRow + '<td style="text-align:center">' + hourResults[i] + '</td>'
  }
  // Finish off final row if the month has more than 28 days
  if (dateResults.length > 27) {
    htmlDateRow = htmlDateRow + '</tr>'
    htmlHourRow = htmlHourRow + '</tr>'
    htmlOutput = htmlOutput + htmlDateRow + "\n" + htmlHourRow
  }
  // Finish table
  htmlOutput = htmlOutput + '</table>'
  Logger.log(htmlOutput)

  var htmlOutput = HtmlService
    .createHtmlOutput(htmlOutput)
    .setWidth(450)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Xero Formatted Hours');
}

function expectedAnnualTax(input) {
  var tax = 0;

  // Calculate regular income tax based on updated tax brackets
  if (input <= 18200) {
    tax = 0; // No tax if income is below $18,201
  } else if (input <= 45000) {
    tax = ((input - 18200) * 0.16); // 16c for each $1 over $18,200
  } else if (input <= 135000) {
    tax = 4288 + ((input - 45000) * 0.30); // $4,288 + 30c for each $1 over $45,000
  } else if (input <= 190000) {
    tax = 31288 + ((input - 135000) * 0.37); // $31,288 + 37c for each $1 over $135,000
  } else {
    tax = 51638 + ((input - 190000) * 0.45); // $51,638 + 45c for each $1 over $190,000
  }

  // Calculate Medicare levy (2% of taxable income)
  var medicareLevy = input * 0.02;
  
  // Add the Medicare levy to the tax calculated
  tax += medicareLevy;

  // Log and return total tax
  Logger.log(tax);
  return tax;
}

// Calculate expected Div 293 repayment
function calculateDiv293Tax(grossIncome, concessionalContributions) {
  var threshold = 250000; // Division 293 tax threshold
  var taxRate = 0.15; // 15% tax rate

  // Sum of gross income and concessional superannuation contributions
  var totalIncome = grossIncome + concessionalContributions;

  // Calculate the excess income over the threshold
  var excessIncome = totalIncome - threshold;

  // If the total income exceeds the threshold, calculate the taxable portion for Division 293
  if (excessIncome > 0) {
    // The taxable portion is the lower of:
    var taxablePortion = Math.min(excessIncome, concessionalContributions);

    // Calculate the Division 293 tax payable (15% of the taxable portion)
    var div293Tax = taxablePortion * taxRate;

    return div293Tax; // Return the calculated tax
  } else {
    return 0; // No Division 293 tax if the income is below the threshold
  }
}