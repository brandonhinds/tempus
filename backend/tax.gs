/** Tax estimation helpers */

function estimateTax(grossIncome, currentDate) {
  grossIncome = Number(grossIncome) || 0;
  if (grossIncome < 0) grossIncome = 0;

  if ((grossIncome % 1).toFixed(2) == 0.33) {
    grossIncome = grossIncome + 0.01;
  }

  var weeklyIncome = Math.floor(grossIncome * (3 / 13)) + 0.99;
  Logger.log('weeklyIncome = ' + weeklyIncome);

  var date = new Date(currentDate);

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

  var a = 0;
  var b = 0;

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

  var weeklyTax = (a * weeklyIncome) - b;
  var monthlyTax = Math.round(weeklyTax * (13 / 3));
  Logger.log('monthlyTax = ' + monthlyTax);

  var medicareLevy = 0;
  Logger.log('medicareLevy = ' + medicareLevy);

  var helpDebt = false;
  var helpRepayment = 0;
  if (helpDebt) {
    var finishedHelpDate = new Date(SpreadsheetApp.getActive().getRange('Config!B14').getValues());
    finishedHelpDate.setDate(finishedHelpDate.getDate() - 1);
    Logger.log('finishedHelpDate = ' + finishedHelpDate);
    Logger.log('currentDate = ' + currentDate);
    if (finishedHelpDate.toString() == 'Invalid Date' || currentDate < finishedHelpDate) {
      helpRepayment = estimateHELP(grossIncome);
    }
  }
  Logger.log('helpRepayment = ' + helpRepayment);

  var totalMonthlyTax = monthlyTax + medicareLevy + helpRepayment;
  Logger.log('totalMonthlyTax = ' + totalMonthlyTax);
  return totalMonthlyTax;
}

function estimateHELP(grossIncome) {
  grossIncome = Number(grossIncome) || 0;
  if (grossIncome < 0) grossIncome = 0;

  var weeklyIncome = Math.floor(grossIncome * (3 / 13)) + 0.99;
  Logger.log('weeklyIncome = ' + weeklyIncome);

  var a = 0;
  if (weeklyIncome < 903.99) { a = 0; } else
  if (weeklyIncome < 1042.99) { a = 0.010; } else
  if (weeklyIncome < 1105.99) { a = 0.020; } else
  if (weeklyIncome < 1171.99) { a = 0.025; } else
  if (weeklyIncome < 1242.99) { a = 0.030; } else
  if (weeklyIncome < 1316.99) { a = 0.035; } else
  if (weeklyIncome < 1395.99) { a = 0.040; } else
  if (weeklyIncome < 1479.99) { a = 0.045; } else
  if (weeklyIncome < 1568.99) { a = 0.050; } else
  if (weeklyIncome < 1662.99) { a = 0.055; } else
  if (weeklyIncome < 1762.99) { a = 0.060; } else
  if (weeklyIncome < 1868.99) { a = 0.065; } else
  if (weeklyIncome < 1980.99) { a = 0.070; } else
  if (weeklyIncome < 2099.99) { a = 0.075; } else
  if (weeklyIncome < 2223.99) { a = 0.080; } else
  if (weeklyIncome < 2359.99) { a = 0.085; } else
  if (weeklyIncome < 2500.99) { a = 0.090; } else
  if (weeklyIncome < 2650.99) { a = 0.095; } else
  { a = 0.100; }

  var weeklyHELP = a * weeklyIncome;
  var monthlyHELP = Math.round(weeklyHELP * (13 / 3));
  Logger.log('monthlyHELP = ' + monthlyHELP);
  return monthlyHELP;
}

