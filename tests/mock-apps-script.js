'use strict';

class MockRange {
  constructor(sheet, row, column, rows, columns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rows = rows || 1;
    this.columns = columns || 1;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.columns; c++) row.push(this.sheet.cell(this.row + r, this.column + c));
      out.push(row);
    }
    return out;
  }
  getDisplayValues() { return this.getValues().map((row) => row.map((value) => String(value == null ? '' : value))); }
  setValues(values) {
    if (!Array.isArray(values) || values.length !== this.rows || values.some((row) => !Array.isArray(row) || row.length !== this.columns)) throw new Error('Mock range dimensions do not match values.');
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.columns; c++) this.sheet.setCell(this.row + r, this.column + c, values[r][c]);
    return this;
  }
  setValue(value) { return this.setValues([[value]]); }
  setNumberFormat() { return this; }
  clearContent() {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.columns; c++) this.sheet.setCell(this.row + r, this.column + c, '');
    return this;
  }
}

class MockSheet {
  constructor(name, values) {
    this.name = name;
    this.values = (values || []).map((row) => row.slice());
    this.maxRows = Math.max(20, this.values.length || 1);
    this.maxColumns = Math.max(20, ...this.values.map((row) => row.length), 1);
  }
  cell(row, column) { return (this.values[row - 1] || [])[column - 1] ?? ''; }
  setCell(row, column, value) {
    while (this.values.length < row) this.values.push([]);
    while (this.values[row - 1].length < column) this.values[row - 1].push('');
    this.values[row - 1][column - 1] = value;
    this.maxRows = Math.max(this.maxRows, row);
    this.maxColumns = Math.max(this.maxColumns, column);
  }
  getName() { return this.name; }
  getSheetName() { return this.name; }
  getLastRow() {
    for (let r = this.values.length - 1; r >= 0; r--) if (this.values[r].some((value) => value !== '' && value != null)) return r + 1;
    return 0;
  }
  getLastColumn() {
    let last = 0;
    this.values.forEach((row) => row.forEach((value, index) => { if (value !== '' && value != null) last = Math.max(last, index + 1); }));
    return last;
  }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxColumns; }
  getRange(row, column, rows, columns) { return new MockRange(this, row, column, rows || 1, columns || 1); }
  getDataRange() { return new MockRange(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  insertRowsAfter(after, count) { this.maxRows = Math.max(this.maxRows, after + count); }
  insertColumnsAfter(after, count) { this.maxColumns = Math.max(this.maxColumns, after + count); }
  appendRow(row) { this.values.push(row.slice()); this.maxRows = Math.max(this.maxRows, this.values.length); this.maxColumns = Math.max(this.maxColumns, row.length); }
  deleteRow(row) { this.values.splice(row - 1, 1); }
  deleteRows(row, count) { this.values.splice(row - 1, count); }
  snapshot() {
    const rows = this.getLastRow();
    const columns = this.getLastColumn();
    return this.values.slice(0, rows).map((row) => Array.from({ length: columns }, (_, index) => row[index] ?? ''));
  }
}

class MockSpreadsheet {
  constructor(fixtures) {
    this.id = 'mock-spreadsheet';
    this.sheets = {};
    Object.entries(fixtures || {}).forEach(([name, values]) => { this.sheets[name] = new MockSheet(name, values); });
  }
  getId() { return this.id; }
  getSheetByName(name) { return this.sheets[name] || null; }
  insertSheet(name) { const sheet = new MockSheet(name, []); this.sheets[name] = sheet; return sheet; }
  getSheets() { return Object.values(this.sheets); }
}

function createProperties(initial) {
  const values = { ...(initial || {}) };
  return {
    getProperty: (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
    setProperty: (key, value) => { values[key] = String(value); },
    deleteProperty: (key) => { delete values[key]; },
    getProperties: () => ({ ...values }),
    getKeys: () => Object.keys(values)
  };
}

function createAppsScriptContext(fixtures) {
  const spreadsheet = new MockSpreadsheet(fixtures);
  const properties = createProperties({ tempus_migrations_applied: JSON.stringify(['tests-ready']) });
  const context = {
    console,
    Date,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    Infinity,
    isFinite,
    isNaN,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    PropertiesService: { getScriptProperties: () => properties },
    Session: { getScriptTimeZone: () => 'Australia/Sydney' },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: {
      getUuid: (() => { let id = 0; return () => 'uuid-' + (++id); })(),
      formatDate: (date, zone, pattern) => {
        const value = new Date(date);
        if (pattern.indexOf("HH:mm:ss") !== -1) return value.toISOString().replace('.000', '');
        return value.toISOString().slice(0, 10);
      },
      Charset: { UTF_8: 'UTF_8' },
      DigestAlgorithm: { SHA_256: 'SHA_256' }
    },
    Logger: { log: () => {} }
  };
  context.globalThis = context;
  return { context, spreadsheet, properties };
}

module.exports = { MockRange, MockSheet, MockSpreadsheet, createAppsScriptContext };
