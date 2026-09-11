'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createAppsScriptContext } = require('./mock-apps-script');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
function fn(name) {
  const match = source.match(new RegExp('  function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(match, name); return match[0];
}
function client() {
  const c = {
    state: { selectedCalendarDate: '2026-09-08', entries: [], hourTypeMap: { work: { requires_contract: true } } },
    daySessionsEdit: null, daySessionsPending: new Map(), daySessionsSaving: false, daySessionsNewId: 0,
    getDefaultHourTypeId: () => 'work', getRoundInterval: () => 0,
    entryPunches: e => e.punches, resolveEntryType: e => e.entry_type,
    hourTypeNeedsContract: ht => !!ht.requires_contract,
    timeToMinutes: t => t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null,
    minutesToTime: m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'),
    formatTime12: t => { const [h,m] = t.split(':').map(Number); return (h % 12 || 12) + ':' + String(m).padStart(2,'0') + (h >= 12 ? 'pm' : 'am'); },
    validatePunches: () => null, setStatus: message => { c.message = message; },
    flagDaySessionContractInvalid: () => {}, renderDayEditor: () => {}, renderDaySessionsTimeline: () => {},
    document: { querySelector: () => null }
  };
  ['parseSmartTime', 'stashDaySessionEdit', 'daySessionEntries', 'daySessionStartAnchor', 'buildDaySessionsBatch', 'saveDaySession', 'cancelDaySessionEdit', 'deleteTimelineSession'].forEach(name => vm.runInNewContext(fn(name), c));
  c.daySessionsPendingKey = (id, index) => id + '#' + index;
  c.daySessionsPendingFor = (id, index) => c.daySessionsPending.get(c.daySessionsPendingKey(id,index));
  return c;
}
function backend() {
  const env = createAppsScriptContext({}), c = env.context;
  for (const file of fs.readdirSync(path.join(root,'backend')).filter(f => f.endsWith('.js'))) vm.runInNewContext(fs.readFileSync(path.join(root,'backend',file),'utf8'),c,{filename:file});
  c.assertMigrationsSettled_ = () => true;
  c.cacheGet = () => null; c.cacheSet = () => {}; c.cacheClearPrefix = () => {};
  c.getOrCreateSheet('hour_types'); c.ensureWorkHourType();
  return env;
}
exports.run = test => {
  test('entry reload returns RPC-safe occurrence keys when Sheets stores them as dates', () => {
    const {context:c,spreadsheet}=backend();
    const generated=c.api_addEntry({date:'2026-06-09',contract_id:'a',entry_type:'basic',duration_minutes:450,
      source_type:'bulk',source_id:'schedule',source_occurrence_key:'2026-06-09'}).entry;
    const manual=c.api_addEntry({date:'2026-09-11',contract_id:'a',entry_type:'advanced',
      punches:[{in:'09:00',out:'12:30'},{in:'13:00',out:'17:10'}]}).entry;
    const sheet=spreadsheet.getSheetByName('timesheet_entries');
    const headers=sheet.snapshot()[0];
    const date=new Date('2026-06-08T14:00:00Z'); // June 9, midnight in Sydney
    sheet.setCell(2,headers.indexOf('source_occurrence_key')+1,date);
    const formatDate=c.Utilities.formatDate;
    c.Utilities.formatDate=(value,zone,pattern)=>{
      if (+value===+date && zone==='Australia/Sydney' && pattern==='yyyy-MM-dd') return '2026-06-09';
      return formatDate(value,zone,pattern);
    };
    const before=sheet.snapshot();
    const entries=c.api_getEntries({});
    const assertRpcSafe=value=>{
      assert.notEqual(Object.prototype.toString.call(value),'[object Date]','Dates cannot cross google.script.run, even inside an older entry');
      if (value && typeof value==='object') Object.values(value).forEach(assertRpcSafe);
    };
    assertRpcSafe(entries);
    assert.equal(entries.find(e=>e.id===generated.id).source_occurrence_key,'2026-06-09');
    assert.equal(entries.find(e=>e.id===manual.id).punches.length,2);
    assert.deepEqual(sheet.snapshot(),before,'reload never rewrites stored cells');
    for (const key of ['', 'billable', '2026-09-11', 'custom-occurrence']) {
      assert.equal(c.normalizeEntryForRead({source_occurrence_key:key}).source_occurrence_key,key);
      assert.equal(c.normalizeEntryForWrite({source_occurrence_key:key}).source_occurrence_key,key);
    }
    assert.equal(c.normalizeEntryForWrite({source_occurrence_key:date}).source_occurrence_key,'2026-06-09');
  });
  test('invalid entry reload responses preserve saved browser entries in both sync paths', () => {
    for (const name of ['fetchEntriesFromServer','refreshEntriesFromServer']) {
      for (const response of [null,undefined,{},[]]) {
        let success, saved=0;
        const original=[{id:'saved-session',date:'2026-09-11'}];
        const c={state:{entries:original,entriesSyncSucceeded:true,entriesSyncEmpty:false},
          beginEntriesSync:()=>1,endEntriesSync:()=>true,setStatus:message=>{c.message=message;},
          sanitizeEntry:e=>e,mergeEntriesWithServerEntries:entries=>{c.state.entries=entries;},
          saveCache:()=>{saved++;},markIncomeDependencyReady:()=>{},renderEntries:()=>{},updateTabStates:()=>{},
          maybePromptDuplicateCleanup:()=>{},ensurePunchDraft:()=>{},settleStatus:()=>{},refreshRestingStatus:()=>{},
          renderBasReporting:()=>{},maybeAutoPopulatePublicHolidayEntries:()=>{},onCalendarMonthChange:()=>{},markAllIncomeSummariesDirty:()=>{}};
        const runner={withSuccessHandler(cb){success=cb;return this;},withFailureHandler(){return this;},api_getEntries(){}};
        c.google={script:{run:runner}};
        vm.runInNewContext(fn(name),c);
        c[name]();success(response);
        if (Array.isArray(response)) {
          assert.equal(c.state.entries.length,0,'a real empty array remains authoritative');
          assert.equal(saved,1);
        } else {
          assert.strictEqual(c.state.entries,original,'an invalid response must not erase cached sessions');
          assert.equal(saved,0);
          assert.equal(c.state.entriesSyncSucceeded,false);
          assert.equal(c.state.entriesSyncEmpty,false);
          assert.match(c.message,/could not be loaded/i);
        }
      }
    }
  });
  test('smart session time accepts 24h, preserves exact minutes and contextual 12h inference', () => {
    const c = client();
    for (const [raw, min] of [['0',0],['00:00',0],['0930',570],['17',1020],['1737',1057],['23:59',1439],['9:07',547],['5pm',1020],['12am',0],['12pm',720]]) assert.equal(c.parseSmartTime(raw).min,min,raw);
    assert.equal(c.parseSmartTime('5').min,300);
    assert.equal(c.parseSmartTime('5', {isEnd:true,startMin:540}).min,1020);
    assert.equal(c.parseSmartTime('1', {anchorMin:720}).min,780);
    assert.equal(c.parseSmartTime('09:30', {anchorMin:720}).min,570);
    assert.equal(c.parseSmartTime('8h', {isEnd:true,startMin:540}).min,1020);
    for (const raw of ['24:00','25','17pm','9:61','9:3x','9:30:20','5:']) assert.ok(c.parseSmartTime(raw).err,raw);
    assert.ok(c.parseSmartTime('8h', {isEnd:true,startMin:1200}).err);
  });
  test('session additions, metadata moves and deletions stay in a cancellable batch', () => {
    const c=client();
    c.state.entries=[{id:'existing',date:c.state.selectedCalendarDate,entry_type:'advanced',hour_type_id:'work',contract_id:'a',punches:[{in:'09:00',out:'12:00'}]}];
    c.daySessionsEdit={mode:'edit',entryId:'existing',punchIndex:0,inVal:'09:00',outVal:'12:00',inRaw:'9:07',htId:'work',contractId:'b'};
    assert.equal(c.stashDaySessionEdit(),true);
    c.daySessionsEdit={mode:'add',inRaw:'13:00',outRaw:'17:00',htId:'work',contractId:'a'};
    assert.equal(c.stashDaySessionEdit(),true);
    const first=c.buildDaySessionsBatch();
    assert.equal(first.changes.length,2,'move and addition are one plan, grouped with the existing entry');
    assert.equal(first.changes.find(x=>x.id==='existing').punches[0].in,'13:00');
    assert.equal(c.state.entries[0].contract_id,'a','no mutation before Save');
    assert.equal(c.state.entries[0].punches[0].in,'09:00');
    const requestIds=first.changes.filter(x=>x.client_request_id).map(x=>x.client_request_id);
    c.stashDaySessionEdit();
    assert.deepEqual(c.buildDaySessionsBatch().changes.filter(x=>x.client_request_id).map(x=>x.client_request_id),requestIds,'retry identity survives restashing');
    c.cancelDaySessionEdit();
    assert.equal(c.daySessionsPending.size,0);
    c.deleteTimelineSession('existing',0);
    assert.equal(c.state.entries.length,1,'delete is local until Save');
    assert.equal(c.buildDaySessionsBatch().changes[0].punches.length,0);
  });
  test('unfinished or invalid time text cannot save an earlier parsed value', () => {
    const c=client();
    c.daySessionsEdit={mode:'add',inVal:'09:00',outVal:'17:00',inRaw:'9:',outRaw:'17:00',htId:'work',contractId:'a'};
    assert.equal(c.stashDaySessionEdit(),false);
    assert.equal(c.daySessionsPending.size,0);
    assert.equal(c.daySessionsEdit.inRaw,'9:');
    c.daySessionsEdit.inRaw='';
    assert.equal(c.stashDaySessionEdit(),false);
  });
  test('failed saves preserve the entire draft and repeated Save sends only one request', () => {
    const c=client(); let calls=0, failure;
    const runner={withSuccessHandler(){return this;},withFailureHandler(cb){failure=cb;return this;},api_saveDaySessions(){calls++;}};
    c.google={script:{run:runner}};
    c.daySessionsEdit={mode:'add',inRaw:'9:07',outRaw:'17:05',htId:'work',contractId:'a'};
    c.saveDaySession(); c.saveDaySession();
    assert.equal(calls,1);
    assert.equal(c.daySessionsSaving,true);
    failure(new Error('Offline'));
    assert.equal(c.daySessionsSaving,false);
    assert.equal(c.daySessionsPending.size,1);
    assert.equal(c.daySessionsEdit.inRaw,'9:07');
    c.saveDaySession(); assert.equal(calls,2);
  });
  test('annual contract filters remove income overrides and filter effective-rate hours', () => {
    const c={state:{hourTypes:[{id:'work',use_for_rate_calculation:true}],contractMap:{a:{hourly_rate:100},b:{hourly_rate:200}},deductions:[],actualIncomeMap:{'2026-08':{gross_income:10000,superannuation:1000,tax:2000,net_income:8000}}},
      ensureIncomeCacheStructures:()=>{},getDefaultIncomeOffset:()=>0, entriesForMonth:()=>[{date:'2026-08-01',contract_id:'a',hour_type_id:'work',duration_minutes:60},{date:'2026-08-02',contract_id:'b',hour_type_id:'work',duration_minutes:120}],
      entryContributesToIncome:()=>true,startOfDay:x=>x,isoDate:d=>d.toISOString().slice(0,10),getSuperGuaranteeRateForDate:()=>0.1,contractIsValid:()=>true,getDefaultHourTypeId:()=> 'work',getFeatureFlag:()=>false,deriveGrossFromPackage:p=>p/1.1,estimateTaxLocal:()=>0,buildAnnualCategoryBreakdown:()=>[],monthKeyFor:()=> '2026-08',getMonthLabel:()=> 'August',GST_RATE:0.1};
    vm.runInNewContext(fn('annualRateHourTypes') + fn('buildAnnualMonthSummary'),c);
    const selected=c.buildAnnualMonthSummary(2026,7,['a']);
    assert.ok(Math.abs(selected.grossIncome-100/1.1)<0.001);
    assert.equal(selected.totalHours,1); assert.equal(selected.rateCalcHours,1); assert.equal(selected.hasActualIncome,false);
    const all=c.buildAnnualMonthSummary(2026,7,['a','b']);
    assert.equal(all.grossIncome,10000); assert.equal(all.rateCalcHours,3); assert.equal(all.hasActualIncome,true);
    const none=c.buildAnnualMonthSummary(2026,7,['missing']);
    assert.equal(none.grossIncome,0);assert.equal(none.rateCalcHours,0);
    c.state.hourTypes = [{id:'work',slug:'work',name:'Work',use_for_rate_calculation:true}, {id:'report',slug:'report',name:'Report writing',is_default:true}];
    c.state.settings = {assessment_time_hour_type_id:'report'};
    c.getFeatureFlag = flag => flag === 'enable_lil_assessments_mode';
    const originalEntries = c.entriesForMonth();
    c.entriesForMonth = () => originalEntries.concat([{date:'2026-08-02',contract_id:'a',hour_type_id:'report',duration_minutes:240}]);
    c.entryContributesToIncome = entry => entry.hour_type_id === 'work';
    const assessment = c.buildAnnualMonthSummary(2026,7,['a']);
    assert.equal(assessment.rateCalcHours,4,'assessment default overrides normal rate type');
    assert.equal(assessment.totalHours,1,'billable hours stay unchanged');
    c.state.settings.assessment_time_hour_type_id = '';
    assert.equal(c.buildAnnualMonthSummary(2026,7,['a']).rateCalcHours,1,'fallback is built-in Work, even with another general default');
    c.state.settings.assessment_time_hour_type_id = 'missing';
    assert.equal(c.buildAnnualMonthSummary(2026,7,['a']).rateCalcHours,1,'deleted default falls back to Work');
    c.state.settings.assessment_time_hour_type_id = 'report';
    c.getFeatureFlag = () => false;
    assert.equal(c.buildAnnualMonthSummary(2026,7,['a']).rateCalcHours,1,'mode off keeps normal rate configuration');

  });
  test('Lil annual effective rate uses zero assessment hours without falling back to billable time', () => {
    const values = [], grid = {innerHTML:'',querySelectorAll:()=>[0,1,2,3].map(i=>({dataset:{i:String(i)}}))};
    const c = {state:{hourTypes:[{id:'report',name:'Report writing'}],settings:{assessment_time_hour_type_id:'report'},annualData:{monthlyData:[{}]}},
      getFeatureFlag:()=>true, avActiveTotals:()=>({grossIncome:1000,totalHours:10,rateCalcHours:0,tax:0}),
      avDataMode:'actual',avIsProjected:()=>false,escapeHtmlSafe:value=>value,formatCurrency:value=>'$'+value,
      document:{getElementById:()=>grid},avCountUp:(key,element,value)=>values.push(value)};
    vm.runInNewContext(fn('annualRateHourTypes') + fn('renderAvMetrics'),c);
    c.renderAvMetrics();
    assert.equal(values[3],0);
    assert.match(grid.innerHTML,/gross ÷ Report writing hrs/);
    c.getFeatureFlag=()=>false; values.length=0; c.renderAvMetrics();
    assert.equal(values[3],100,'ordinary mode retains its existing fallback');
  });
  test('server annual rate selection honours Lil default, Work fallback, and mode changes in the cache key', () => {
    const {context:c}=backend();
    const types=[{id:'work',slug:'work',use_for_rate_calculation:true},{id:'report',slug:'report',is_default:true}];
    assert.deepEqual(Array.from(c.annualRateHourTypeIds_(types,true,'report')),['report']);
    assert.deepEqual(Array.from(c.annualRateHourTypeIds_(types,true,'')),['work']);
    assert.deepEqual(Array.from(c.annualRateHourTypeIds_(types,true,'deleted')),['work']);
    assert.deepEqual(Array.from(c.annualRateHourTypeIds_(types,false,'report')),['work']);
    let lil=true, selected='report'; const keys=[];
    c.api_getHourTypes=()=>types;
    c.api_getFeatureFlags=()=>({enable_lil_assessments_mode:{enabled:lil}});
    c.api_getSettings=()=>({assessment_time_hour_type_id:selected});
    c.cacheGet=key=>{keys.push(key);return {cached:true};};
    c.api_getAnnualSummary({yearType:'calendar',startYear:2026});
    selected=''; c.api_getAnnualSummary({yearType:'calendar',startYear:2026});
    lil=false; c.api_getAnnualSummary({yearType:'calendar',startYear:2026});
    assert.equal(new Set(keys).size,3,'selection and mode changes cannot reuse stale annual totals');
  });
  test('server annual summary keeps recorded income and rate hours in the selected contract scope', () => {
    const {context:c}=backend();
    c.getSuperGuaranteeRate=()=>0.1;
    const entries=[{date:'2026-08-01',contract_id:'a',hour_type_id:'work',duration_minutes:60},{date:'2026-08-02',contract_id:'b',hour_type_id:'work',duration_minutes:120}];
    const contracts={a:{hourly_rate:100},b:{hourly_rate:200}}, types={work:{contributes_to_income:true}};
    const deductions={getDataRange:()=>({getValues:()=>[[]]})};
    const actual={'2026-08':{gross_income:10000,superannuation:1000,tax:2000,net_income:8000}};
    const selected=c.buildMonthlySummaryForAnnual(2026,7,[entries[0]],entries,contracts,types,deductions,actual,['work']);
    assert.ok(Math.abs(selected.grossIncome-100/1.1)<0.001);
    assert.equal(selected.rateCalcHours,1); assert.equal(selected.hasActualIncome,false);
    const all=c.buildMonthlySummaryForAnnual(2026,7,entries,entries,contracts,types,deductions,actual,['work']);
    assert.equal(all.grossIncome,10000);assert.equal(all.rateCalcHours,3);assert.equal(all.hasActualIncome,true);
  });
  test('Sheets session batch validates before writing, preserves other rows and supports response-loss retries', () => {
    const {context:c,spreadsheet}=backend();
    const original=c.api_addEntry({date:'2026-09-08',contract_id:'a',entry_type:'advanced',punches:[{in:'09:00',out:'12:00'}]}).entry;
    c.api_addEntry({date:'2026-09-09',contract_id:'a',entry_type:'basic',duration_minutes:60});
    const sheet=spreadsheet.getSheetByName('timesheet_entries'), before=sheet.snapshot();
    const expected={punches_json:original.punches_json,contract_id:'a',hour_type_id:original.hour_type_id};
    const payload={date:'2026-09-08',changes:[{id:original.id,expected,punches:[{in:'09:07',out:'12:00'}],round_interval:0},{client_request_id:'new-session-1',contract_id:'b',punches:[{in:'13:00',out:'25:00'}],round_interval:0}]};
    assert.throws(()=>c.api_saveDaySessions(payload),/valid session times/);
    assert.deepEqual(sheet.snapshot(),before,'invalid last row prevents every write');
    payload.changes[1].punches[0].out='17:00';
    const result=c.api_saveDaySessions(payload);
    assert.equal(result.entries.length,2);
    assert.equal(c.api_getEntries({}).length,3);
    assert.deepEqual(sheet.snapshot()[2],before[2],'other day is unchanged');
    c.api_saveDaySessions(payload);
    assert.equal(c.api_getEntries({}).length,3,'retry does not duplicate new sessions');
    payload.changes[0].punches[0].in='09:10';
    assert.throws(()=>c.api_saveDaySessions(payload),/changed elsewhere/);
    const saved=result.entries.find(e=>e.id===original.id);
    c.api_saveDaySessions({date:payload.date,changes:[{id:original.id,expected:{punches_json:saved.punches_json,contract_id:'a',hour_type_id:saved.hour_type_id},punches:[]}]});
    assert.equal(c.api_getEntries({}).length,2,'deleted batch rows are excluded from reads');
  });
  test('browser batches save multiple sessions after RPC reorders snapshot properties', () => {
    for (const sameContract of [true, false]) {
      const {context:server}=backend(), c=client();
      const date=c.state.selectedCalendarDate;
      server.api_addEntry({date,contract_id:'a',entry_type:'advanced',punches:sameContract
        ? [{in:'09:00',out:'12:00'},{in:'13:00',out:'17:00'}]
        : [{in:'09:00',out:'12:00'}]});
      if (!sameContract) server.api_addEntry({date,contract_id:'b',entry_type:'advanced',punches:[{in:'13:00',out:'17:00'}]});
      c.state.entries=server.api_getEntries({});
      const first=c.state.entries[0], last=c.state.entries[c.state.entries.length-1];
      c.daySessionsPending.set(first.id+'#0',{inVal:'09:07',outVal:'12:00',htId:first.hour_type_id,contractId:first.contract_id});
      c.daySessionsPending.set(last.id+'#'+(sameContract?1:0),{inVal:'13:00',outVal:'17:05',htId:last.hour_type_id,contractId:last.contract_id});
      c.daySessionsEdit={mode:'add',inRaw:'18:00',outRaw:'19:00',htId:first.hour_type_id,contractId:'a'};
      assert.equal(c.stashDaySessionEdit(),true);
      const payload=JSON.parse(JSON.stringify(c.buildDaySessionsBatch()));
      payload.changes.forEach(change=>{
        const expected=change.expected;
        // RPC objects need not retain the browser's property insertion order.
        change.expected={hour_type_id:expected.hour_type_id,contract_id:expected.contract_id,punches_json:expected.punches_json};
      });
      server.api_saveDaySessions(payload);
      const saved=server.api_getEntries({});
      assert.deepEqual(JSON.parse(JSON.stringify(saved.flatMap(e=>e.punches))).sort((a,b)=>a.in.localeCompare(b.in)),
        [{in:'09:07',out:'12:00'},{in:'13:00',out:'17:05'},{in:'18:00',out:'19:00'}]);
      server.api_saveDaySessions(payload);
      assert.deepEqual(server.api_getEntries({}),saved,'retry keeps every session without duplication');
    }
  });
  test('session snapshot normalization accepts equivalent JSON but rejects concurrent changes atomically', () => {
    for (const concurrent of [null, {punches:[{in:'09:10',out:'12:00'}]}, {contract_id:'b'}, {hour_type_id:'other'}]) {
      const {context:c,spreadsheet}=backend();
      const date='2026-09-08';
      const original=c.api_addEntry({date,contract_id:'a',entry_type:'advanced',punches:[{in:'09:00',out:'12:00'},{in:'13:00',out:'17:00'}]}).entry;
      const payload={date,changes:[
        {client_request_id:'additional-session',contract_id:'c',punches:[{in:'18:00',out:'19:00'}]},
        {id:original.id,expected:{contract_id:'a',hour_type_id:original.hour_type_id,
          punches_json:JSON.stringify([{out:'17:00',in:'13:00'},{out:'12:00',in:'09:00'}],null,2)},
        punches:[{in:'09:07',out:'12:00'},{in:'13:00',out:'17:05'}]}
      ]};
      if (concurrent) c.api_updateEntry(Object.assign({},original,concurrent));
      const sheet=spreadsheet.getSheetByName('timesheet_entries'), before=sheet.snapshot();
      if (concurrent) {
        assert.throws(()=>c.api_saveDaySessions(payload),/changed elsewhere/);
        assert.deepEqual(sheet.snapshot(),before,'conflict prevents the entire batch from writing');
      } else {
        assert.equal(c.api_saveDaySessions(payload).entries.length,2);
      }
    }
  });
};
