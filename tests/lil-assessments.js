'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createAppsScriptContext } = require('./mock-apps-script');
function lilContext(sheets) {
  const env = createAppsScriptContext(sheets || {}), c = env.context;
  for (const file of fs.readdirSync(path.join(__dirname,'../backend')).filter(f=>f.endsWith('.js'))) vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../backend',file),'utf8'),c,{filename:file});
  c.assertMigrationsSettled_ = () => true;
  c.cacheGet = () => null; c.cacheSet = () => {}; c.cacheClearPrefix = () => {};
  c.sha256Hex_ = value => crypto.createHash('sha256').update(String(value)).digest('hex');
  c.assessmentToday_ = () => '2026-09-08';
  c.Utilities.formatDate = (date,zone,pattern) => {const d=new Date(date);if(pattern==='yyyy')return String(d.getUTCFullYear());if(pattern==='M')return String(d.getUTCMonth()+1);return pattern.includes('HH:mm:ss')?d.toISOString():d.toISOString().slice(0,10);};
  c.getOrCreateSheet('hour_types');c.ensureWorkHourType();
  c.createHourTypeUnlocked_({id:'report',name:'Report writing',slug:'report',contributes_to_income:false,is_default:false});
  const report=c.api_getHourTypes().find(t=>t.slug==='report');
  const contract=c.api_addContract({name:'Assessment services',start_date:'2025-01-01',hourly_rate:800,assessment_organisations:' Northbridge, Eastwood, northbridge, ,Eastwood '}).contract;
  let counter=0;
  env.create = overrides => c.api_upsertAssessment(Object.assign({assessment_date:'2026-08-28',contract_id:contract.id,assessment_type_id:'enhanced',organisation:'Northbridge',client_name:'Maya Thompson',client_dob:'1992-02-14',percentage_adjustment:0,client_request_id:'assessment-'+(++counter),request_id:'save-'+counter},overrides)).assessment;
  env.report=report;env.contract=contract;
  return env;
}
function mockDrive(c) {
  const files=new Map();let count=0,fail='',onRender=null;
  const templateId='original-template-1234567890',folderId='invoice-folder-1234567890';
  // The template is modelled as blocks so row removal is exercised for real: the 18 line slots are
  // table rows in one table, flanked by a header row, a totals row and loose text.
  const buildBlocks=()=>{
    const blocks=[{kind:'row',table:'lines',text:'Date | Service Description | Amount'}];
    for(let i=1;i<=18;i++) blocks.push({kind:'row',table:'lines',text:`{{date${i}}} | {{serviceDescription${i}}} | {{amount${i}}}`});
    blocks.push({kind:'row',table:'lines',text:'Subtotal: {{subtotal}} GST: {{gst}} Total: {{total}}'});
    blocks.push({kind:'text',text:'{{invoiceNumber}} {{date}} {{invoiceDate}} {{assessmentPeriod}} {{invoiceTotalWithGst}}'});
    return blocks;
  };
  const source={getId:()=>templateId,getName:()=> 'Original template',makeCopy:()=>{if(fail==='copy')throw Error('Drive copy failed');const id='generated-'+(++count);
    const file={id,trashed:false,blocks:buildBlocks(),get text(){return this.blocks.map(b=>b.text).join('\n');},
      getId:()=>id,getName:()=>id,getUrl:()=> 'https://docs.google.com/document/d/'+id,
      setTrashed:value=>{if(fail==='trash')throw Error('Trash failed');file.trashed=value;}};
    files.set(id,file);return file;}};
  c.DriveApp={getFileById:id=>{if(id===templateId)return source;if(files.has(id))return files.get(id);throw Error('File not found');},getFolderById:id=>{if(id!==folderId)throw Error('Folder missing');return {getId:()=>folderId,getName:()=> 'Invoices'};}};
  const TYPE={TEXT:'TEXT',PARAGRAPH:'PARAGRAPH',TABLE_CELL:'TABLE_CELL',TABLE_ROW:'TABLE_ROW',TABLE:'TABLE',BODY_SECTION:'BODY_SECTION'};
  c.DocumentApp={ElementType:TYPE,openById:id=>{
    const file=files.get(id);
    const table=name=>({getType:()=>TYPE.TABLE,getParent:()=>bodySection,
      getNumRows:()=>file.blocks.filter(b=>b.kind==='row'&&b.table===name).length});
    const bodySection={getType:()=>TYPE.BODY_SECTION,getParent:()=>null};
    const rowFor=block=>({getType:()=>TYPE.TABLE_ROW,getParent:()=>table(block.table),
      removeFromParent:()=>{const at=file.blocks.indexOf(block);if(at!==-1)file.blocks.splice(at,1);}});
    const elementFor=block=>{
      const parent=block.kind==='row'?rowFor(block):bodySection;
      const cell={getType:()=>TYPE.TABLE_CELL,getParent:()=>parent};
      const paragraph={getType:()=>TYPE.PARAGRAPH,getParent:()=>block.kind==='row'?cell:bodySection};
      return {getType:()=>TYPE.TEXT,getParent:()=>paragraph};
    };
    return {getBody:()=>({
      getText:()=>file.text,
      replaceText:(pattern,value)=>{if(fail==='render')throw Error('Render failed');
        const re=new RegExp(pattern,'g');file.blocks.forEach(b=>{b.text=b.text.replace(re,()=>value);});},
      findText:pattern=>{const re=new RegExp(pattern);const block=file.blocks.find(b=>re.test(b.text));
        return block?{getElement:()=>elementFor(block)}:null;}
    }),getHeader:()=>null,getFooter:()=>null,
    saveAndClose:()=>{if(onRender){const callback=onRender;onRender=null;callback();}if(fail==='save')throw Error('Save failed');}};}};
  c.api_updateSettings({invoice_template_doc_id:templateId,invoice_output_folder_id:folderId,invoice_line_item_limit:18});
  return {files,get count(){return count;},set fail(value){fail=value;},set onRender(fn){onRender=fn;},templateId};
}
module.exports={lilContext,mockDrive,run(test){
  test('Lil catalogue restores all five original wordings and percent-unit fees',()=>{
    const {context:c,create}=lilContext();
    assert.equal(c.api_listAssessmentTypes().length,5);
    const expected={standard:800,enhanced:884,reval:884,'cancellation-under-24':600,'cancellation-over-24':400};
    for(const [type,amount] of Object.entries(expected))for(const percent of [0,.5,1,10]){const a=create({assessment_type_id:type,percentage_adjustment:percent/100});assert.equal(a.fee,Math.round(amount*(1+percent/100)*100)/100);assert.ok(a.lines.every(l=>!/[{}]/.test(l.description)));assert.match(a.lines[0].description,/Maya Thompson \(DOB: 14\/02\/1992\)/);if(percent&&!type.startsWith('cancellation'))assert.ok(a.lines[0].description.includes(' + '+percent+'% Surge'));}
  });
  test('assessment rate snapshots, organisation history, revision and create retry remain stable',()=>{
    const {context:c,contract,create}=lilContext();const a=create();
    c.api_updateContract({...contract,hourly_rate:999,assessment_organisations:'Eastwood'});
    let record=c.assessmentFind_('assessments',a.id).item;
    assert.equal(c.decorateAssessment_(record).fee,884);
    const edited=c.api_upsertAssessment({...a,client_name:'Updated name',request_id:'edit-1',expected_revision:a.revision}).assessment;
    assert.equal(edited.fee,884);assert.ok(edited.lines[0].description.includes('Updated name'));
    assert.throws(()=>c.api_upsertAssessment({...a,request_id:'stale',expected_revision:a.revision}),/changed/);
    assert.equal(c.api_upsertAssessment({...a,client_name:'Updated name',request_id:'edit-1',expected_revision:a.revision}).assessment.revision,edited.revision);
    assert.throws(()=>create({organisation:'Northbridge'}),/organisation/);
    const repriced=c.api_upsertAssessment({...edited,percentage_adjustment:.1,request_id:'edit-2',expected_revision:edited.revision}).assessment;assert.equal(repriced.fee,1214.28);
    assert.equal(c.findAssessmentBillableEntry_(a.id).income_amount,1214.28);
    assert.deepEqual(Array.from(c.assessmentOrganisations_(' A, a,, B ,b,C ')),['A','B','C']);
  });
  test('actual time retains multiple same-day identities, cross-month dates and non-billable enforcement',()=>{
    const {context:c,report,create}=lilContext();const a=create();
    const input={assessment_id:a.id,hour_type_id:report.id,date:'2026-09-02',hours:1.5,client_request_id:'time-1'};
    const t=c.api_upsertAssessmentTimeEntry(input).entry;c.api_upsertAssessmentTimeEntry({...input,client_request_id:'time-2'});c.api_upsertAssessmentTimeEntry(input);
    assert.equal(c.decorateAssessment_(c.assessmentFind_('assessments',a.id).item).actual_minutes,180);
    const moved=c.api_upsertAssessment({...a,assessment_date:'2026-09-01',expected_revision:a.revision,request_id:'move'}).assessment;
    assert.equal(c.findAssessmentBillableEntry_(a.id).date,'2026-09-01');assert.equal(moved.time_entries[0].date,'2026-09-02');
    const work=c.api_getHourTypes().find(t=>t.contributes_to_income);
    assert.throws(()=>c.api_upsertAssessmentTimeEntry({...input,hour_type_id:work.id,client_request_id:'bad'}),/non-billable/);
    assert.throws(()=>c.api_updateEntry({...t,hour_type_id:work.id}),/non-billable/);
    assert.throws(()=>c.api_updateEntry({...t,source_type:'manual',source_id:'',assessment_id:''}),/detached/);
    const other=create();assert.throws(()=>c.api_upsertAssessmentTimeEntry({...input,id:t.id,assessment_id:other.id}),/belong/);
    const billing=c.findAssessmentBillableEntry_(a.id);assert.throws(()=>c.api_updateEntry({...billing,source_type:'manual',source_id:'',source_occurrence_key:''}),/automatic/);assert.throws(()=>c.api_deleteEntry(billing.id),/automatic/);
    assert.throws(()=>c.api_upsertAssessmentTimeEntry({...input,hours:Infinity}),/positive/);assert.throws(()=>c.api_upsertAssessmentTimeEntry({...input,hours:.001}),/minute/);
    assert.throws(()=>c.api_updateHourType(report.id,{contributes_to_income:true}),/non-billable/);
    c.api_setAssessmentTimeDefault(report.id);assert.equal(c.api_getAssessmentWorkHourTypeId(),report.id);assert.throws(()=>c.api_updateSettings({assessment_time_hour_type_id:work.id}),/non-billable/);
    assert.equal(c.api_getEntries({}).filter(e=>e.source_id===a.id).length,3);
  });
  test('assessment save and delete recover interrupted multi-sheet writes without losing actual time',()=>{
    const {context:c,create,report}=lilContext();const a=create();c.api_upsertAssessmentTimeEntry({assessment_id:a.id,hour_type_id:report.id,date:'2026-09-02',hours:2,client_request_id:'time'});
    const original=c.assessmentWrite_;let once=true;c.assessmentWrite_=(name,record)=>{if(name==='assessments'&&once){once=false;throw Error('Sheets interrupted');}return original(name,record);};
    const edit={...a,assessment_date:'2026-09-01',expected_revision:a.revision,request_id:'recover'};assert.throws(()=>c.api_upsertAssessment(edit),/interrupted/);
    const retried=c.api_upsertAssessment(edit).assessment;assert.equal(retried.assessment_date,'2026-09-01');assert.equal(retried.actual_minutes,120);assert.equal(c.api_getEntries({}).filter(e=>c.assessmentEntryIsBillable_(e)).length,1);
    c.api_deleteAssessment({id:a.id,expected_revision:retried.revision,request_id:'delete'});assert.equal(c.api_getEntries({}).length,0);assert.equal(c.assessmentFind_('assessments',a.id).item,null);
  });
  test('monthly invoice combines contracts, snapshots lines and replaces only after successful rendering',()=>{
    const {context:c,create,contract,report}=lilContext();const drive=mockDrive(c);const a=create();
    const other=c.api_addContract({...contract,id:'',name:'Other services',hourly_rate:400}).contract;create({contract_id:other.id,organisation:'Eastwood',assessment_type_id:'standard'});
    const request={year:2026,month:8,request_id:'invoice-1',expected_hash:c.lilInvoiceInputs_('2026-08').hash};
    const first=c.api_generateLilMonthlyInvoice(request).invoice;assert.equal(first.kind,'lil_assessment');assert.equal(first.source_month,'2026-08');assert.equal(c.listInvoiceLineItemsByInvoiceId(first.id).length,3);assert.equal(c.summarizeInvoiceLineItems(c.listInvoiceLineItemsByInvoiceId(first.id)).totalAmount,1284);
    assert.match(drive.files.get(first.generated_doc_id).text,/2026-08/);assert.equal(c.api_generateLilMonthlyInvoice(request).invoice.id,first.id);assert.equal(drive.count,1);
    const hash=c.lilInvoiceInputs_('2026-08').hash;c.api_upsertAssessmentTimeEntry({assessment_id:a.id,hour_type_id:report.id,date:'2026-09-03',hours:2,client_request_id:'late'});assert.equal(c.lilInvoiceInputs_('2026-08').hash,hash);
    c.api_upsertAssessment({...a,percentage_adjustment:.1,request_id:'price-change',expected_revision:a.revision});assert.equal(c.lilMonthInvoiceState_('2026-08').stale,true);
    const replace={year:2026,month:8,request_id:'invoice-2',expected_hash:c.lilInvoiceInputs_('2026-08').hash,confirmed_document_id:first.generated_doc_id};
    assert.throws(()=>c.api_generateLilMonthlyInvoice({...replace,confirmed_document_id:''}),/Confirm/);
    drive.fail='render';assert.throws(()=>c.api_generateLilMonthlyInvoice(replace),/Render failed/);assert.equal(c.findInvoiceById(first.id).generated_doc_id,first.generated_doc_id);assert.equal(c.invoiceLedgerTotal_(first.id),1412.4);assert.equal(drive.files.get(first.generated_doc_id).trashed,false);
    drive.fail='';const second=c.api_generateLilMonthlyInvoice(replace).invoice;assert.equal(second.id,first.id);assert.equal(second.invoice_number,first.invoice_number);assert.equal(second.invoice_date,first.invoice_date);assert.notEqual(second.generated_doc_id,first.generated_doc_id);assert.equal(drive.files.get(first.generated_doc_id).trashed,true);assert.equal(c.listInvoiceLineItemsByInvoiceId(first.id).length,3);
    assert.equal(c.timesheetForecastForPeriod_('2026-08-01','2026-08-31').uninvoiced_time,0);
  });
  test('invoice generation rejects overflow, concurrent edits, empty months and preserves commit after response loss',()=>{
    const {context:c,create}=lilContext();const drive=mockDrive(c);const a=create();
    c.api_updateSettings({invoice_line_item_limit:1});let request={year:2026,month:8,request_id:'overflow',expected_hash:c.lilInvoiceInputs_('2026-08').hash};assert.throws(()=>c.api_generateLilMonthlyInvoice(request),/limit/);assert.equal(drive.count,0);
    c.api_updateSettings({invoice_line_item_limit:20});request={...request,request_id:'edit-race',expected_hash:c.lilInvoiceInputs_('2026-08').hash};
    drive.onRender=()=>c.api_upsertAssessment({...a,client_name:'Changed while rendering',expected_revision:a.revision,request_id:'during-render'});assert.throws(()=>c.api_generateLilMonthlyInvoice(request),/changed during/);assert.equal(c.lilInvoiceForMonth_('2026-08').generated_doc_id,'');
    const write=c.updateInvoiceRecord;let lose=true;c.updateInvoiceRecord=(id,updates)=>{write(id,updates);if(updates.generation_request_id&&lose){lose=false;throw Error('Response lost after commit');}};
    request={...request,request_id:'lost-response',expected_hash:c.lilInvoiceInputs_('2026-08').hash};const committed=c.api_generateLilMonthlyInvoice(request);assert.equal(committed.success,true);assert.equal(drive.files.get(committed.invoice.generated_doc_id).trashed,false);const copies=drive.count;c.api_generateLilMonthlyInvoice(request);assert.equal(drive.count,copies);
    assert.throws(()=>c.api_generateLilMonthlyInvoice({year:2026,month:7,request_id:'empty',expected_hash:c.lilInvoiceInputs_('2026-07').hash}),/Add an assessment/);
  });
  test('cleanup failure retains the committed invoice and retries cleanup without another generation',()=>{
    const {context:c,create}=lilContext();const drive=mockDrive(c);create();const request={year:2026,month:8,request_id:'first',expected_hash:c.lilInvoiceInputs_('2026-08').hash};const first=c.api_generateLilMonthlyInvoice(request).invoice;
    drive.fail='trash';const next=c.api_generateLilMonthlyInvoice({...request,request_id:'second',confirmed_document_id:first.generated_doc_id}).invoice;assert.notEqual(next.generated_doc_id,first.generated_doc_id);assert.equal(drive.files.get(first.generated_doc_id).trashed,false);
    drive.fail='';c.api_getLilInvoiceGeneration(2026,8);assert.equal(drive.files.get(first.generated_doc_id).trashed,true);assert.equal(drive.count,2);
  });
  test('Lil routing gives explicit links priority, redirects removed invoices, and preserves mode-off time launch',()=>{
    const {context:c}=lilContext();assert.equal(c.pickInitialPage_(true,''),'assessments');assert.equal(c.pickInitialPage_(true,'time'),'time');assert.equal(c.pickInitialPage_(false,''),'time');assert.equal(c.pickInitialPage_(true,'invoices'),'assessments');assert.equal(c.pickInitialPage_(false,'invoices'),'time');assert.equal(c.pickInitialPage_(false,'assessments'),'time');
    for(const f of ['scripts','operations-scripts']){const s=fs.readFileSync(path.join(__dirname,'../views/partials',f+'.html'),'utf8');assert.ok(!/enable_assessments\b|enable_invoices\b|enable_contract_line_item_templates\b/.test(s));}
    assert.equal(typeof c.api_upsertAssessmentType,'undefined');assert.equal(typeof c.api_upsertInvoice,'undefined');
  });
  test('the standalone invoice and generic assessment surfaces are gone while reporting readers survive',()=>{
    const {context:c}=lilContext();
    const read=f=>fs.readFileSync(path.join(__dirname,'../views',f),'utf8');
    // The standalone Invoices page is removed outright, not merely unlinked.
    assert.ok(!fs.existsSync(path.join(__dirname,'../views/partials/invoices.html')));
    assert.ok(!/partials\/invoices/.test(read('index.html')));
    assert.ok(!/nav-invoices|page-invoices/.test(read('index.html')+read('partials/navbar.html')+read('partials/scripts.html')));
    // The generic assessment editor left no renderer, catalogue state or DOM host behind.
    const ops=read('partials/operations-scripts.html');
    assert.ok(!/renderAssessmentList|assessmentTypes|assessment-list|api_deleteAssessment/.test(ops));
    assert.ok(/enable_lil_assessments_mode/.test(ops),'the transfer split keeps its Lil-mode gate');
    // Help no longer documents the retired draft/issue/void lifecycle or configurable fields.
    const help=read('partials/operations.html');
    assert.ok(!/Invoice lifecycle|stable field keys|Voiding|line item templates/i.test(help));
    assert.ok(/Monthly invoice/.test(help)&&/Lil Assessments mode/.test(help));
    // Retired endpoints and their orphaned helpers are absent...
    for(const name of ['api_getInvoice', 'api_getInvoiceReconciliation', 'api_upsertInvoice', 'api_deleteInvoice', 'api_issueInvoice', 'api_markInvoiceSent', 'api_voidInvoice', 'api_reviseInvoice', 'api_recalculateInvoiceDraft', 'api_generateInvoiceDocument', 'api_upsertInvoiceLineItem', 'api_deleteInvoiceLineItem', 'api_upsertInvoiceDefaultLineItem', 'api_deleteInvoiceDefaultLineItem', 'api_listInvoiceDefaultLineItems', 'api_refreshInvoiceLineItemEntry', 'api_addInvoicePayment', 'api_deleteInvoicePayment', 'api_upsertAssessmentType', 'api_deleteAssessmentType', 'api_generateAssessmentInvoices', 'api_previewAssessmentInvoices', 'api_sendAssessmentInvoice', 'api_unlockAssessmentInvoice', 'api_exportAssessmentDocument', 'api_listAssessmentInvoicesForMonth', 'listDefaultInvoiceLineItems', 'enrichLineItemsWithEntryState', 'updateLineItemRecord', 'getContractRateById', 'invoicePaymentState_']) assert.equal(typeof c[name],'undefined',name+' should be removed');
    // ...while everything Lil generation, payments and BAS reporting still read stays defined.
    for(const name of ['api_listInvoices', 'invoicePaymentsForInvoice_', 'invoicePaymentSummaryByInvoice_', 'invoiceCashAllocationForPeriod_', 'renderInvoiceDocument_', 'buildInvoiceReplacementData', 'applyInvoiceReplacements', 'resolveInvoiceTemplate', 'resolveInvoiceOutputFolder', 'getNextInvoiceSequence', 'findInvoiceById', 'listInvoiceLineItemsByInvoiceId', 'summarizeInvoiceLineItems']) assert.equal(typeof c[name],'function',name+' must be retained');
  });
  test('a sole valid contract and its sole organisation preselect, and pickers open Monday-first',()=>{
    const partial=fs.readFileSync(path.join(__dirname,'../views/partials/assessments-scripts.html'),'utf8');
    // Run the three real functions against a stub DOM rather than asserting on source text.
    const grab=name=>{const at=partial.indexOf('  function '+name+'(');assert.notEqual(at,-1,name);
      const next=partial.indexOf('\n  function ',at+1);return partial.slice(at,next===-1?partial.length:next);};
    const sandbox={state:{contracts:[]},nodes:{},lilSetup(){},console};
    sandbox.lilEscape=v=>String(v==null?'':v);
    sandbox.lilEl=id=>sandbox.nodes[id]||(sandbox.nodes[id]={innerHTML:'',onclick:null});
    vm.runInNewContext(grab('lilOptions')+'\n'+grab('lilOrganisations')+'\n'+grab('lilRefreshFormOptions')
      +'\nthis.run=lilRefreshFormOptions;',sandbox);

    const contract={id:'c1',name:'Assessment services',start_date:'2025-01-01',assessment_organisations:'Northbridge'};
    // One valid contract, one organisation: both fill in without the user choosing.
    sandbox.state.contracts=[contract];
    let draft={assessment_date:'2026-09-04',contract_id:'',organisation:''};
    sandbox.run(draft);
    assert.equal(draft.contract_id,'c1');
    assert.equal(draft.organisation,'Northbridge','a sole organisation still preselects through the auto-selected contract');

    // Two valid contracts stay an explicit choice.
    sandbox.state.contracts=[contract,{id:'c2',name:'Second',start_date:'2025-01-01',assessment_organisations:'Eastwood'}];
    draft={assessment_date:'2026-09-04',contract_id:'',organisation:''};
    sandbox.run(draft);
    assert.equal(draft.contract_id,'');

    // No date yet means no contract is valid, so nothing is guessed.
    sandbox.state.contracts=[contract];
    draft={assessment_date:'',contract_id:'',organisation:''};
    sandbox.run(draft);
    assert.equal(draft.contract_id,'');

    // A sole contract that is out of date range is not selected either.
    sandbox.state.contracts=[{id:'c3',name:'Ended',start_date:'2025-01-01',end_date:'2025-06-30',assessment_organisations:'X'}];
    draft={assessment_date:'2026-09-04',contract_id:'',organisation:''};
    sandbox.run(draft);
    assert.equal(draft.contract_id,'');

    // A remembered valid contract is never overridden by the sole-option rule.
    sandbox.state.contracts=[contract,{id:'c2',name:'Second',start_date:'2025-01-01',assessment_organisations:'Eastwood'}];
    draft={assessment_date:'2026-09-04',contract_id:'c2',organisation:'Eastwood'};
    sandbox.run(draft);
    assert.equal(draft.contract_id,'c2');

    // Every dropdown calendar starts on Monday, matching the calendar/agenda/mobile week grids.
    const client=fs.readFileSync(path.join(__dirname,'../views/partials/scripts.html'),'utf8');
    assert.match(client,/function createDatePicker\(input, extraOpts\)[\s\S]*?firstDayOfWeek: 1/);
    assert.equal((client.match(/window\.flatpickr\(/g)||[]).length,1,'one picker factory, so week start cannot drift');
  });
  test('assessment validation identifies every bad field and checks real dates and contract eligibility',()=>{
    const partial=fs.readFileSync(path.join(__dirname,'../views/partials/assessments-scripts.html'),'utf8');
    const grab=name=>{const at=partial.indexOf('  function '+name+'('),next=partial.indexOf('\n  function ',at+1);return partial.slice(at,next);};
    const contract={id:'c1',start_date:'2025-01-01',end_date:'2026-12-31',assessment_organisations:'Northbridge'};
    const sandbox={state:{contracts:[contract]},lilState:{month:'2026-09'},todayIso:()=> '2026-09-12',lilData:()=>({types:[{id:'standard'}]}),lilMonthLabel:month=>month};
    vm.runInNewContext(['lilOrganisations','lilValidDate','lilAssessmentErrors','lilReadAssessmentForm'].map(grab).join('\n'),sandbox);
    const valid={assessment_date:'2026-09-04',contract_id:'c1',assessment_type_id:'standard',organisation:'Northbridge',client_name:'Maya',client_dob:'1992-02-29',adjustment_percent:0};
    const errors=patch=>sandbox.lilAssessmentErrors({...valid,...patch});
    assert.equal(errors({}).length,0);
    assert.equal(errors({adjustment_percent:100}).length,0);
    assert.equal(errors({adjustment_percent:12.5}).length,0);
    for(const value of ['', ' ', 'abc', -1, 101, Infinity])assert.equal(errors({adjustment_percent:value})[0].field,'adjustment_percent');
    for(const value of ['', '2026-02-30', '2026-13-04', '04/09/2026'])assert.match(errors({assessment_date:value})[0].message,/Assessment date: enter a valid date/);
    assert.match(errors({assessment_date:'2026-08-04'})[0].message,/2026-09.*switch to 2026-08/);
    assert.equal(errors({id:'existing',assessment_date:'2026-08-04'}).length,0,'editing may move an assessment to another month');
    assert.match(errors({client_dob:'2026-09-13'})[0].message,/Date of birth:.*earlier/);
    assert.match(errors({client_dob:'1991-02-29'})[0].message,/Date of birth: enter a valid date/);
    assert.equal(errors({client_dob:'2026-09-12'}).length,0);
    assert.match(errors({contract_id:'missing'})[0].message,/Contract:/);
    assert.equal(errors({assessment_type_id:'missing'})[0].field,'assessment_type_id');
    assert.equal(errors({organisation:'Other'})[0].field,'organisation');
    assert.equal(errors({organisation:'Historical',original:{contract_id:'c1',organisation:'Historical'}}).length,0);
    assert.equal(errors({client_name:'  '})[0].field,'client_name');
    contract.archived=true;
    assert.match(errors({})[0].message,/Contract: this contract is not active/);
    assert.equal(errors({id:'existing',original:{contract_id:'c1'}}).length,0);
    contract.archived=false;contract.end_date='2026-09-01';
    assert.match(errors({})[0].message,/Contract: this contract is not active/);
    contract.end_date='2026-12-31';
    assert.deepEqual(Array.from(errors({client_name:'',client_dob:'',adjustment_percent:''}),error=>error.field),['client_name','client_dob','adjustment_percent']);

    // The visible picker and autofilled controls can be ahead of both the hidden ISO input and draft.
    const nodes=Object.entries(valid).map(([name,value])=>({name,value}));
    const dob=nodes.find(node=>node.name==='client_dob');dob.value='';dob._flatpickr={altInput:{value:'14/02/1992'}};
    const date=nodes.find(node=>node.name==='assessment_date');date._flatpickr={altInput:{value:'5/9/2026'}};
    sandbox.lilEl=()=>({querySelectorAll:()=>nodes});
    const draft={...valid,client_name:'',client_dob:'',assessment_date:''};
    sandbox.lilReadAssessmentForm(draft);
    assert.equal(draft.client_dob,'1992-02-14');assert.equal(draft.assessment_date,'2026-09-05');assert.equal(draft.client_name,'Maya');
    assert.equal(sandbox.lilAssessmentErrors(draft).length,0);
    dob._flatpickr.altInput.value='31/02/1992';sandbox.lilReadAssessmentForm(draft);
    assert.equal(sandbox.lilAssessmentErrors(draft)[0].field,'client_dob','impossible typed dates must not roll into the next month');
    dob._flatpickr.altInput.value='';sandbox.lilReadAssessmentForm(draft);
    assert.equal(draft.client_dob,'','clearing the visible date must not reuse an old hidden value');
  });
  test('the Lil migration archives only affected rows and its cost does not grow with sheet size',()=>{
    // Rebuilding the migration_archive index per row, and copying whole sheets into it, made the
    // upgrade quadratic. Guard both: bounded Sheets traffic, and an archive scoped to changed rows.
    function migrate(entryCount){
      const entryHeaders=['id','date','duration_minutes','contract_id','created_at','punches_json','entry_type','hour_type_id','recurrence_id','note','assessment_id','source_type','source_id','source_occurrence_key','client_request_id','income_amount'];
      const entries=[entryHeaders];
      for(let i=0;i<entryCount;i++) entries.push(['e'+i,'2026-08-10',60,'c1','','[]','basic','work','','','','manual','','','','']);
      entries.push(['b1','2026-08-04',60,'c1','','[]','basic','work','','','a1','assessment','a1','billable','','800']);
      entries.push(['t1','2026-09-03',30,'c1','','[]','basic','work','','','a1','assessment','a1','','','']);
      const sheets={
        timesheet_entries:entries,
        assessments:[['id','assessment_type_id','contract_id','organisation','assessment_date','field_values_json','percentage_adjustment','status','invoice_id','notes','created_at','updated_at','client_name','client_dob','pricing_snapshot_json','revision','client_request_id','last_request_id','migration_warning','lil_migrated'],
          ['a1','t-std','c1','','2026-08-04','{"subject_name":"Ada L","subject_date_of_birth":"1979-04-02","organisation":"Northbridge"}','','','','','','','','','','','','','','']],
        contracts:[['id','name','start_date','end_date','hourly_rate','total_hours','include_weekends','standard_hours_per_day','line_item_templates_json','color','archived','entry_mode','standard_day_json','created_at','specified_personnel','work_order_number','contract_reference','timesheet_statement','assessment_organisations'],
          ['c1','Assessment services','2025-01-01','',800,0,'FALSE',7.5,'','','FALSE','','','2025-01-01','','','','','']],
        hour_types:[['id','name','slug','contributes_to_income','is_default','archived','created_at','updated_at'],
          ['work','Work','work','TRUE','TRUE','FALSE','',''],['report','Report writing','report','FALSE','FALSE','FALSE','','']],
        feature_flags:[['feature','enabled','name','description'],['enable_assessments','TRUE','Assessments',''],['enable_expenses','TRUE','Expenses','']],
        user_settings:[['key','value'],['accounting_basis','cash'],['assessment_filename_pattern','x-{n}']],
        assessment_types:[['id','name','description','field_definitions_json','line_templates_json','active','created_at','updated_at'],['t-std','Standard','','[]','[]','TRUE','','']],
        migration_archive:[['id','migration_id','source_sheet','source_row_json','reason','archived_at']]
      };
      const env=createAppsScriptContext(sheets), c=env.context;
      for(const file of fs.readdirSync(path.join(__dirname,'../backend')).filter(f=>f.endsWith('.js'))) vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../backend',file),'utf8'),c,{filename:file});
      c.assertMigrationsSettled_=()=>true;
      c.cacheGet=()=>null;c.cacheSet=()=>{};c.cacheClearPrefix=()=>{};
      c.sha256Hex_=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
      c.Utilities.formatDate=(d,z,pattern)=>{const x=new Date(d);return pattern.includes('HH:mm:ss')?x.toISOString():x.toISOString().slice(0,10);};
      const sheet=env.spreadsheet.getSheetByName('timesheet_entries');
      const SheetProto=Object.getPrototypeOf(sheet), RangeProto=Object.getPrototypeOf(sheet.getDataRange());
      const original={append:SheetProto.appendRow,get:RangeProto.getValues,set:RangeProto.setValues};
      let calls=0;
      SheetProto.appendRow=function(r){calls++;return original.append.call(this,r);};
      RangeProto.getValues=function(){calls++;return original.get.call(this);};
      RangeProto.setValues=function(v){calls++;return original.set.call(this,v);};
      try{
        c.MIGRATION_CONTEXT.active=true;
        c.migrationLilAssessments_();
        const archive=env.spreadsheet.getSheetByName('migration_archive').snapshot();
        // Idempotent: a second run must change nothing and must not duplicate archive rows.
        c.PropertiesService.getScriptProperties().deleteProperty('lil_assessments_migrated');
        c.migrationLilAssessments_();
        return {calls,archive,repeat:env.spreadsheet.getSheetByName('migration_archive').snapshot(),
                assessments:env.spreadsheet.getSheetByName('assessments').snapshot()};
      } finally {
        SheetProto.appendRow=original.append;RangeProto.getValues=original.get;RangeProto.setValues=original.set;
      }
    }

    const small=migrate(20), large=migrate(2000);
    // Cost is driven by sheet count, not row count: 100x the rows must not cost meaningfully more.
    assert.ok(large.calls < small.calls * 1.5, 'migration cost scales with row count: '+small.calls+' -> '+large.calls);
    assert.ok(large.calls < 200, 'migration should stay near a fixed number of Sheets calls, got '+large.calls);

    const rows=large.archive.slice(1), headers=large.archive[0];
    const sheetIndex=headers.indexOf('source_sheet'), jsonIndex=headers.indexOf('source_row_json');
    const bySheet=rows.reduce((m,r)=>{m[r[sheetIndex]]=(m[r[sheetIndex]]||0)+1;return m;},{});
    // Only the one assessment-time row on a billable type is archived, not all 2000 entries.
    assert.equal(bySheet.timesheet_entries,1,'archived timesheet rows: '+JSON.stringify(bySheet));
    assert.ok(rows.some(r=>r[sheetIndex]==='timesheet_entries'&&/"id":"t1"/.test(r[jsonIndex])),'the billable-type actual-time row is recorded');
    assert.equal(bySheet.assessments,1,'the rewritten assessment is archived');
    assert.equal(bySheet.contracts,1,'the contract whose organisations were initialised is archived');
    assert.equal(bySheet.feature_flags,1,'only the retired flag is archived');
    assert.ok(!rows.some(r=>/enable_expenses/.test(r[jsonIndex])),'an untouched flag is not archived');
    assert.equal(bySheet.user_settings,1,'only the retired setting is archived');
    assert.ok(!rows.some(r=>/accounting_basis/.test(r[jsonIndex])),'an untouched setting is not archived');
    assert.equal(bySheet.assessment_types,undefined,'a type that maps cleanly needs no archive copy');

    assert.deepEqual(large.repeat,large.archive,'a repeat run must not duplicate archive rows');
    // The conversion itself still happened.
    const aHeaders=large.assessments[0], a=large.assessments[1];
    assert.equal(a[aHeaders.indexOf('client_name')],'Ada L');
    assert.equal(a[aHeaders.indexOf('organisation')],'Northbridge');
    assert.equal(a[aHeaders.indexOf('assessment_type_id')],'standard');
    assert.equal(a[aHeaders.indexOf('lil_migrated')],'TRUE');
    assert.ok(JSON.parse(a[aHeaders.indexOf('pricing_snapshot_json')]).rate===800);
  });
  test('duplicate detection needs matching times and origin, not just a day and hour type',()=>{
    // Lil records an assessment (which writes an automatic billing entry) and separately tracks time on
    // the same day. Keying duplicates on date + hour type alone flagged those as copies of each other,
    // and flagged two tracked sessions on one day as copies too.
    const partial=fs.readFileSync(path.join(__dirname,'../views/partials/entry-core.html'),'utf8');
    const body=partial.replace(/^[\s\S]*?<script>/,'').replace(/<\/script>[\s\S]*$/,'');
    const sandbox={window:{},console};
    vm.runInNewContext(body,sandbox);
    const core=sandbox.window.entryCore;
    const key=e=>core.entryDuplicateKey(e,'work');
    const entry=o=>Object.assign({date:'2026-09-03',contract_id:'c1',hour_type_id:'work',entry_type:'basic',duration_minutes:60,punches:[],source_type:'manual',source_id:'',source_occurrence_key:''},o);

    // The reported false positive: the automatic billing row versus ordinary time the same day.
    const billing=entry({source_type:'assessment',source_id:'a1',source_occurrence_key:'billable'});
    assert.notEqual(key(billing),key(entry({})),'assessment billing must not collide with a manual entry');
    assert.equal(core.entryIsAssessmentBilling(billing),true);
    assert.equal(core.entryIsAssessmentBilling(entry({})),false);
    assert.equal(core.entryIsAssessmentBilling(entry({source_type:'assessment',source_id:'a1'})),false,'tracked time is not the billing row');

    // Tracked assessment time versus ordinary time of the same shape on the same day.
    const tracked=entry({hour_type_id:'report',source_type:'assessment',source_id:'a1'});
    assert.notEqual(key(tracked),key(entry({hour_type_id:'report'})),'tracked time is not a copy of manual time');

    // Two tracked sessions on one day: different lengths, and same length on different assessments.
    assert.notEqual(key(tracked),key(entry({hour_type_id:'report',source_type:'assessment',source_id:'a1',duration_minutes:90})),'different lengths are different entries');
    assert.notEqual(key(tracked),key(entry({hour_type_id:'report',source_type:'assessment',source_id:'a2'})),'different assessments are never each other duplicates');
    // ...but the same session saved twice still is a duplicate.
    assert.equal(key(tracked),key(entry({hour_type_id:'report',source_type:'assessment',source_id:'a1'})));

    // Ordinary entries: genuine doubles still caught, different lengths left alone.
    assert.equal(key(entry({})),key(entry({})),'an identical manual entry is still a duplicate');
    assert.notEqual(key(entry({})),key(entry({duration_minutes:61})),'a different duration is a different entry');
    assert.notEqual(key(entry({})),key(entry({contract_id:'c2'})),'a different contract is a different entry');
    assert.notEqual(key(entry({})),key(entry({date:'2026-09-04'})),'a different day is a different entry');
    assert.notEqual(key(entry({})),key(entry({hour_type_id:'report'})),'a different hour type is a different entry');

    // Punch entries of equal length at different clock times are distinct sessions.
    const morning=entry({entry_type:'advanced',duration_minutes:60,punches:[{in:'09:00',out:'10:00'}]});
    const afternoon=entry({entry_type:'advanced',duration_minutes:60,punches:[{in:'14:00',out:'15:00'}]});
    assert.notEqual(key(morning),key(afternoon),'same length at different times is not a duplicate');
    assert.equal(key(morning),key(entry({entry_type:'advanced',duration_minutes:60,punches:[{in:'09:00',out:'10:00'}]})));

    // An empty hour type still resolves to the default, so it matches an explicit default.
    assert.equal(key(entry({hour_type_id:''})),key(entry({hour_type_id:'work'})));

    // Break and comment rows keep their deliberate one-per-day-per-contract rule.
    ['break','comment'].forEach(kind=>{
      const a=entry({entry_type:kind,duration_minutes:30}),b=entry({entry_type:kind,duration_minutes:45});
      assert.equal(key(a),key(b),kind+' rows stay one per day and contract regardless of length');
    });

    // Both surfaces must use the shared rule rather than their own.
    const desktop=fs.readFileSync(path.join(__dirname,'../views/partials/scripts.html'),'utf8');
    const mobile=fs.readFileSync(path.join(__dirname,'../views/partials/mobile-entry-scripts.html'),'utf8');
    assert.match(desktop,/function findDuplicateEntryInState\(payload, excludeId\)[\s\S]*?duplicateKeyFor\(entry\)/);
    assert.match(desktop,/function findDuplicateGroups[\s\S]*?isAssessmentBillingEntry\(entry\)/);
    assert.match(mobile,/const findDuplicate = \(payload\)[\s\S]*?entryDuplicateKey\(e, defaultHourTypeId\(\)\)/);
    assert.ok(!/entryCompositeKey\(e\.date/.test(mobile),'mobile no longer keys duplicates on the day slot');
  });
  test('an assessment that cannot be invoiced names the field to fix, and saving it unblocks the month',()=>{
    const {context:c,create,contract}=lilContext();
    const complete=create({assessment_date:'2026-08-04',client_name:'Ada Lovelace'});
    const hash=()=>c.lilInvoiceInputs_('2026-08').hash;
    // A complete month validates.
    c.lilValidateInvoiceRows_(c.lilInvoiceInputs_('2026-08'));

    const gap=(fields)=>{
      c.assessmentWrite_('assessments',Object.assign({id:'gap-1',assessment_type_id:'standard',contract_id:contract.id,
        assessment_date:'2026-08-06',client_name:'Grace Hopper',client_dob:'1906-12-09',organisation:'Northbridge',
        percentage_adjustment:0,pricing_snapshot_json:JSON.stringify({rate:800,lines:[{id:'standard-1',template:'{org} report for {name}',multiplier:1,amount:800}]}),
        revision:1,migration_warning:''},fields));
      try { c.lilValidateInvoiceRows_(c.lilInvoiceInputs_('2026-08')); return ''; }
      catch (error) { return error.message; }
    };

    assert.equal(gap({organisation:''}),'Grace Hopper: Add the organisation.');
    assert.equal(gap({client_dob:''}),'Grace Hopper: Add the date of birth.');
    assert.equal(gap({client_dob:'',organisation:''}),'Grace Hopper: Add the date of birth and organisation.');
    assert.equal(gap({assessment_type_id:'mystery',client_dob:'',organisation:''}),'Grace Hopper: Add the assessment type, date of birth and organisation.');
    assert.equal(gap({pricing_snapshot_json:''}),'Grace Hopper: Add the fee.');
    // A migrated row with every field present still needs confirming, and says how.
    assert.equal(gap({migration_warning:'Historical custom type needs review.'}),
      'Grace Hopper: Historical custom type needs review. Open it, check the details and save to confirm them.');
    // Both causes are reported together rather than one hiding the other.
    assert.equal(gap({organisation:'',migration_warning:'Historical custom type needs review.'}),
      'Grace Hopper: Add the organisation. Historical custom type needs review. Open it, check the details and save to confirm them.');
    // A nameless row is still identifiable.
    assert.match(gap({client_name:''}),/^The assessment dated 2026-08-06: Add the client name\.$/);

    // The screen flags it before Generate Invoice is pressed.
    gap({organisation:'',migration_warning:'Historical custom type needs review.'});
    const month=c.api_getAssessmentsForMonth(2026,8);
    const flagged=month.assessments.find(a=>a.id==='gap-1');
    assert.equal(flagged.invoice_blockers.length,2,'both reasons reach the client');
    assert.equal(month.assessments.find(a=>a.id===complete.id).invoice_blockers.length,0);

    // Generation refuses while the gap stands...
    assert.throws(()=>c.api_generateLilMonthlyInvoice({year:2026,month:8,request_id:'blocked',expected_hash:hash()}),/Add the organisation/);
    // ...and saving the assessment clears the warning and the gap, so the month can be invoiced.
    const repaired=c.api_upsertAssessment({id:'gap-1',request_id:'repair',expected_revision:flagged.revision,
      assessment_date:'2026-08-06',contract_id:contract.id,assessment_type_id:'standard',organisation:'Northbridge',
      percentage_adjustment:0,client_name:'Grace Hopper',client_dob:'1906-12-09'}).assessment;
    assert.equal(repaired.invoice_blockers.length,0);
    assert.equal(repaired.migration_warning,'');
    c.lilValidateInvoiceRows_(c.lilInvoiceInputs_('2026-08'));
  });
  test('the assessments screen keeps its interactions optimistic and logs several days at once',()=>{
    const ui=fs.readFileSync(path.join(__dirname,'../views/partials/assessments-scripts.html'),'utf8');
    const css=fs.readFileSync(path.join(__dirname,'../views/partials/assessments.html'),'utf8');

    // Operations queue per assessment rather than being dropped, which is what lets the detail panel
    // stay pressable while a save is still in flight.
    assert.match(ui,/while\(lilState\.pending\.has\(key\)\)[\s\S]*?await lilState\.chains\[key\]/);
    assert.ok(!/if\(lilState\.pending\.has\(key\)\)return;/.test(ui),'a queued action must not be silently dropped');
    assert.ok(!/pending\?'disabled'/.test(ui),'no control is greyed out merely because a save is running');

    // Month switching paints at once; only an unseen month shows loading state, and it clears on failure.
    assert.match(ui,/if\(!lilData\(\)\)lilRenderLoading\(\); else lilSetMonthControl\(month\);/);
    assert.match(ui,/function lilRenderLoading\(\)[\s\S]*?lilEl\('summary'\)\.innerHTML=lilSkeleton\(3\)/);
    assert.match(ui,/function lilRenderLoading\(\)[\s\S]*?lilEl\('list'\)\.innerHTML=lilSkeleton\(3\)/);
    assert.match(ui,/lilRenderLoading\(\)[\s\S]*?lilEl\('add'\)\.disabled=true/);
    assert.match(ui,/lilEl\('add'\)\.disabled=false/);
    assert.match(css,/\.ts-asm-skeleton \{/);
    // The skeleton pulse is motion, so it stays inside the reduced-motion guard.
    const motion=css.slice(css.indexOf('@media(prefers-reduced-motion:no-preference)'));
    assert.match(motion,/\.ts-asm-skeleton span \{ animation/);

    // Generate acknowledges the click before its pre-flight round trip.
    assert.match(ui,/lilState\.checking\[month\]=true;lilRenderInvoice\(\);/);
    assert.match(ui,/checking\?'Checking…'/);

    // Several days in one submit, each row its own request id, saved one at a time, partial commits kept.
    assert.match(ui,/id="lil-time-add-row">Add another day</);
    assert.match(ui,/rows\.push\(\{id:'',hour_type_id:last\.hour_type_id,date:last\.date,hours:'',client_request_id:lilRequestId\(\)\}\)/);
    assert.match(ui,/for\(const row of prepared\)\{[\s\S]*?await lilApi\('api_upsertAssessmentTimeEntry'/);
    assert.match(ui,/error\.partial=saved; throw error;/);
    assert.match(ui,/const remaining=prepared\.filter\(row=>!savedRequests\.has\(String\(row\.client_request_id\)\)\)/);
    assert.match(ui,/data-remove-row/);

    // Field order: client name and date of birth share a row, adjustment sits last.
    const gridStart=ui.indexOf('class="ts-grid ts-grid--gap-md"');
    const grid=ui.slice(gridStart,ui.indexOf('Fee preview',gridStart));
    const order=['Assessment date','>Contract<','>Type<','lil-organisation','Client name','Date of birth','Adjustment (%)']
      .map(token=>grid.indexOf(token));
    assert.ok(order.every((pos,i)=>pos>-1&&(i===0||pos>order[i-1])),'unexpected field order: '+JSON.stringify(order));
    // Each pair shares a row: no field spans the grid.
    assert.ok(!/ts-col-span-12/.test(grid),'no assessment field spans the whole row');

    // Dates read DD/MM/YYYY while the model stays ISO.
    assert.match(ui,/altInput:true,altFormat:'d\/m\/Y'/);
    assert.ok(!/altInput:false/.test(ui),'no assessment date field is left on the ISO display format');
    assert.match(ui,/altInput\.required=true/,'the visible date field stays required');

    // The first configured organisation is chosen, not only a sole one.
    assert.match(ui,/draft\.organisation=organisations\[0\]\|\|''/);

    // Sole traders default to an accrual basis; a saved basis still wins.
    const ops=fs.readFileSync(path.join(__dirname,'../views/partials/operations-scripts.html'),'utf8');
    assert.match(ops,/function defaultAccountingBasis\(\)[\s\S]*?state\.settings\.accounting_basis\)\|\|\(soleTraderMode\(\)\?'accrual':'cash'\)/);
    assert.ok(!/accounting_basis\)\|\|'cash'/.test(ops),'no hardcoded cash default remains');

    // The logo follows Lil mode, and the target is selectable.
    const client=fs.readFileSync(path.join(__dirname,'../views/partials/scripts.html'),'utf8');
    assert.match(client,/brand_shortcut_target\) \|\| \(lilMode \? 'assessments' : 'time'\)/);
    assert.match(client,/if \(target === 'assessments' && !lilMode\) target = 'time';/);
    assert.match(fs.readFileSync(path.join(__dirname,'../views/partials/settings.html'),'utf8'),/id="brand-shortcut-opt-assessments"/);

    // The month sits between its two arrows and is centred in its button.
    const stepper=css.slice(css.indexOf('class="ts-agenda-week-stepper"'));
    const controls=['id="lil-prev"','id="lil-month-btn"','id="lil-next"'].map(token=>stepper.indexOf(token));
    assert.ok(controls.every((pos,i)=>pos>-1&&(i===0||pos>controls[i-1])),'the month must sit between the arrows');
    assert.match(css,/\.ts-asm-month-btn \{[^}]*justify-content:center/);
  });
  test('assessments is built from the shared ts-* components, not a private visual language',()=>{
    const ui=fs.readFileSync(path.join(__dirname,'../views/partials/assessments-scripts.html'),'utf8');
    const page=fs.readFileSync(path.join(__dirname,'../views/partials/assessments.html'),'utf8');
    const css=page.slice(page.indexOf('<style>'),page.indexOf('</style>'));
    const shared=fs.readFileSync(path.join(__dirname,'../views/partials/head.html'),'utf8');
    const client=fs.readFileSync(path.join(__dirname,'../views/partials/scripts.html'),'utf8');

    // The bespoke .lil-* visual language is gone. Its rules were what let the screen drift away from
    // Time Entry and Annual View, and .lil-row alone spent eight !important declarations undoing the
    // global button pill.
    assert.ok(!/\.lil-[a-z-]+\s*[,{]/.test(css),'no .lil-* rule survives in the assessments stylesheet');
    assert.equal((css.match(/!important/g)||[]).length,1,'the only !important left is the [hidden] guard');
    assert.match(css,/#page-assessments \[hidden\] \{ display:none !important; \}/);

    // Every strip shares the track Time Entry and Annual View clamp their content to, or the toolbar and
    // panels sit wider than the KPI cards between them.
    assert.match(css,/\.ts-asm-strip \{[^}]*max-width:min\(1280px, calc\(100vw - \(2 \* var\(--space-4\)\)\)\)/);
    ['ts-toolbar ts-asm-strip','ts-av-panel ts-av-section ts-asm-strip','ts-av-two-col ts-av-section ts-asm-strip']
      .forEach(cls=>assert.ok(page.includes('class="'+cls+'"'),'missing shared-width strip: '+cls));

    // Each region is the component the other screens already use for the same job.
    assert.ok(page.includes('id="lil-summary" class="ts-stat-cards"'),'month totals use the Time Entry KPI strip');
    assert.ok(page.includes('id="lil-list" class="ts-agenda-list"'),'the list is the agenda list');
    assert.match(ui,/function lilStatCard[\s\S]*?ts-stat-card-value/);
    assert.match(ui,/function lilRowHtml[\s\S]*?class="ts-agenda-row/);
    assert.match(ui,/function lilRenderSnapshot[\s\S]*?class="ts-income-breakdown"/);
    assert.match(ui,/function lilSnapshotRow[\s\S]*?class="ts-income-row/);
    assert.match(ui,/function lilRenderDetail[\s\S]*?class="ts-entry-editing"/);
    assert.match(ui,/function lilTimeSectionHtml[\s\S]*?class="ts-day-duration-row"/);
    assert.match(ui,/function lilRenderForm[\s\S]*?class="ts-grid ts-grid--gap-md"/);
    // Status is a badge, not a third line of appended grey text.
    assert.match(ui,/class="ts-badge warn">Needs details</);
    assert.ok(!/' · Needs details'/.test(ui),'row status no longer rides on appended text');

    // The agenda row is a div[role=button] there and here, so nothing has to fight the button pill —
    // and role=button without keyboard activation would be a button in name only.
    assert.match(ui,/class="ts-agenda-row[\s\S]{0,80}role="button" tabindex="0"/);
    assert.match(ui,/addEventListener\('keydown',event=>\{if\(event\.key==='Enter'\|\|event\.key===' '\)/);

    // Nothing is invented that head.html already provides, and no shared component is redefined here.
    // A scoped placement (#lil-snapshot .ts-income-breakdown) is fine — restyling the component itself,
    // which is how the screen drifted the first time, is not.
    ['.ts-stat-cards','.ts-agenda-row','.ts-income-breakdown','.ts-av-panel','.ts-entry-editing','.ts-day-duration-row','.ts-empty-state','.ts-badge']
      .forEach(sel=>{
        assert.ok(shared.includes(sel+' {')||shared.includes(sel+','),'expected '+sel+' to be a shared rule');
        const redefined=new RegExp('^\\s*\\'+sel+'\\s*[,{]','m');
        assert.ok(!redefined.test(css),'assessments must not redefine '+sel);
      });

    // The month picker is shared rather than duplicated: it takes an anchor and a callback, and the
    // calendar's own month label now goes through the same entry point.
    assert.match(client,/function openMonthPickerFor\(anchor, active, onPick\)/);
    assert.match(client,/function openMonthPicker\(\)[\s\S]*?openMonthPickerFor\(monthPickerJumpBtn/);
    assert.match(ui,/openMonthPickerFor\(lilEl\('month-btn'\)/);

    // The snapshot rows balance against the invoice total, which is what lets one bar and one % column
    // describe them: income + retained_in_business === invoice_total.
    const backend=fs.readFileSync(path.join(__dirname,'../backend/assessmentInvoices.js'),'utf8');
    assert.match(backend,/retained_in_business: roundMoney_\(netGst \+ tax \+ superAmount \+ expenses\.paid\)/);
  });
  test('this month and last ride along in the browser cache, and repainting does not restart the fade',()=>{
    const ui=fs.readFileSync(path.join(__dirname,'../views/partials/assessments-scripts.html'),'utf8');
    const client=fs.readFileSync(path.join(__dirname,'../views/partials/scripts.html'),'utf8');
    const shared=fs.readFileSync(path.join(__dirname,'../views/partials/head.html'),'utf8');

    // Cached through the app's own browser cache, not a private one: the blob rides in the same payload
    // as entries and contracts, so it is written, versioned and cleared with everything else.
    assert.match(client,/assessmentMonths: typeof serializeAssessmentMonths === 'function' \? serializeAssessmentMonths\(\) : \(state\.assessmentMonths \|\| \{\}\)/);
    assert.match(client,/state\.assessmentMonths = obj\.assessmentMonths && typeof obj\.assessmentMonths === 'object' \? obj\.assessmentMonths : \{\}/);
    assert.match(client,/^\s*assessmentMonths: \{\},$/m,'state declares the restored blob');
    // loadCache runs from init() before the assessments partial is parsed, so the partial adopts it.
    assert.match(ui,/const cached=state\.assessmentMonths;[\s\S]*?lilState\.months\[month\]=data;lilState\.hydrated\.add\(month\)/);

    // Exactly two months, derived from today — and the same list gates both the write and the read, so
    // reopening months later cannot resurrect a month that is no longer cacheable.
    assert.match(ui,/function lilCacheMonths\(\)[\s\S]*?getMonth\(\)-1/);
    assert.match(ui,/function serializeAssessmentMonths\(\)[\s\S]*?lilCacheMonths\(\)\.forEach/);
    assert.match(ui,/const allowed=new Set\(lilCacheMonths\(\)\);/);

    // An unconfirmed save is not server truth and must not be restored as though it were.
    assert.match(ui,/function serializeAssessmentMonths\(\)[\s\S]*?lilMonthPending\(month\)\|\|lilMonthFailed\(month\)\)return;/);
    // Contracts and hour types are already in the main payload; a second per-month copy would give the
    // same records two sources of truth.
    assert.match(ui,/delete copy\.contracts;delete copy\.hour_types;/);
    assert.match(ui,/function lilAdoptReferenceData\(data\)[\s\S]*?if\(Array\.isArray\(data\.contracts\)\)/);

    // A cached month paints first, then confirms itself once, and a failed background check leaves the
    // cached view alone rather than raising an error over data that is already on screen.
    assert.match(ui,/if\(lilData\(\) && !options\?\.force\)\{lilRender\(\);lilRevalidate\(month\);return;\}/);
    assert.match(ui,/async function lilRevalidate\(month\)[\s\S]*?lilState\.hydrated\.delete\(month\)/);
    assert.match(ui,/lilRevalidate[\s\S]*?catch\(error\)\{\s*console\.warn/);
    const revalidate=ui.slice(ui.indexOf('async function lilRevalidate(month)'));
    assert.ok(!revalidate.slice(0,revalidate.indexOf('\n  function ')).includes('lilRenderLoading'),
      'a background refresh must not show loading state');

    // Persisted where the month's data actually moves, never merely on paint.
    ['lilState.months[month]=data;lilState.hydrated.delete(month);\n      lilAdoptReferenceData(data);lilPersist();',
     'lilState.months[month]=data;lilAdoptReferenceData(data);lilPersist();',
     'lilState.epoch++;lilRender();lilPersist();']
      .forEach(snippet=>assert.ok(ui.includes(snippet),'missing persist point: '+snippet));
    assert.ok(!/function lilRender\(listOnly\)[\s\S]*?lilPersist\(\)[\s\S]*?function lilRenderInvoice/.test(ui),
      'lilRender must not persist on every paint');

    // The flash: .ts-income-breakdown and .ts-note both start at opacity:0 behind a fadeIn, so replacing
    // a node with byte-identical markup restarted the fade. lilRender() repaints the invoice panel on
    // every selection and every search keystroke, none of which changes the invoice.
    assert.match(shared,/\.ts-income-breakdown \{[^}]*opacity:0; animation: fadeIn/);
    assert.match(shared,/\.ts-note \{[^}]*opacity:0; animation: fadeIn/);
    assert.match(ui,/function lilPaint\(host, html\) \{\s*if\(!host \|\| host\.__lilHtml===html\)return false;/);
    assert.match(ui,/function lilRenderSnapshot[\s\S]*?lilPaint\(host,\(stale\?/);
    assert.match(ui,/if\(!snap\)\{lilPaint\(host,''\);return;\}/,'clearing the snapshot must also clear the marker');
    assert.match(ui,/lilPaint\(lilEl\('historical-invoices'\)/);
    assert.ok(!/lilEl\('snapshot'\)\.innerHTML=/.test(ui) && !/host\.innerHTML=\(stale/.test(ui),
      'the snapshot must only be written through lilPaint');
  });
  test('a date Sheets coerced into a Date still validates, prints DD/MM/YYYY and orders correctly',()=>{
    const {context:c,create,contract,spreadsheet}=lilContext();
    const first=create({assessment_date:'2026-08-28',client_name:'John May',client_dob:'1985-04-12'});
    create({assessment_date:'2026-08-04',client_name:'Ada Lovelace',client_dob:'1979-04-02'});
    const sheet=spreadsheet.getSheetByName('assessments');
    const headers=sheet.values[0];
    const col=name=>headers.indexOf(name)+1;

    // A new row is appended with its text columns claimed, which is what stops the coercion happening.
    const dobFormat=sheet.getRange(2,col('client_dob'),1,1).getNumberFormats()[0][0];
    assert.equal(dobFormat,'@','an appended row claims the text format for its date columns');

    // Reproduce a sheet that was written before that, where the cell holds a real Date.
    const rowFor=id=>sheet.values.findIndex(r=>r[headers.indexOf('id')]===id)+1;
    const johnRow=rowFor(first.id);
    // UTC noon, the same convention normalizeIsoDateStrict_ uses, so the calendar day is unambiguous.
    // (The harness stubs Utilities.formatDate as UTC-only; real Apps Script formats in the
    // spreadsheet's timezone, which is what INVOICE_SHEET_TZ reads.)
    sheet.getRange(johnRow,col('client_dob'),1,1).setValues([[new Date(Date.UTC(1985,3,12,12))]]);
    sheet.getRange(johnRow,col('assessment_date'),1,1).setValues([[new Date(Date.UTC(2026,7,28,12))]]);

    // Reading normalises, so validation no longer reports "must use YYYY-MM-DD".
    const row=c.assessmentRows_('assessments').rows.find(r=>String(r.id)===String(first.id));
    assert.equal(row.client_dob,'1985-04-12');
    assert.equal(row.assessment_date,'2026-08-28');
    const inputs=c.lilInvoiceInputs_('2026-08');
    assert.doesNotThrow(()=>c.lilValidateInvoiceRows_(inputs));

    // The invoice wording carries a real date, not a stringified Date object.
    const lines=c.resolveAssessmentLines_(row);
    assert.ok(lines.length,'the line survived');
    assert.match(lines[0].description,/DOB: 12\/04\/1985/);
    assert.ok(!/GMT|Apr 12 1985/.test(lines[0].description),'no raw Date leaked into the document text');

    // Ordering is by calendar date; a stringified Date would have sorted on the weekday name.
    assert.deepEqual(inputs.rows.map(r=>r.client_name),['Ada Lovelace','John May']);

    // Editing such a record still works: the stored Date must not reach the strict validator.
    const decorated=c.api_getAssessmentsForMonth(2026,8).assessments.find(a=>a.id===first.id);
    assert.equal(decorated.client_dob,'1985-04-12');
    assert.doesNotThrow(()=>c.api_upsertAssessment({id:first.id,request_id:'edit-coerced',expected_revision:decorated.revision,
      assessment_date:'2026-08-28',contract_id:contract.id,assessment_type_id:'enhanced',organisation:'Northbridge',
      percentage_adjustment:0,client_name:'John May',client_dob:'1985-04-12'}));
  });
  test('generating an invoice snapshots what is hers, and only invoice inputs make it out of date',()=>{
    const env=lilContext(),c=env.context,create=env.create,contract=env.contract;
    const drive=mockDrive(c);
    const first=create({assessment_date:'2026-08-04',assessment_type_id:'standard',client_name:'Ada Lovelace'});
    const gen=()=>c.api_generateLilMonthlyInvoice({year:2026,month:8,request_id:'gen-'+Math.random(),
      expected_hash:c.lilInvoiceInputs_('2026-08').hash,
      confirmed_document_id:(c.lilInvoiceForMonth_('2026-08')||{}).generated_doc_id||''});
    const state=()=>c.api_getAssessmentsForMonth(2026,8).invoice;

    assert.equal(state().snapshot,null,'nothing is snapshotted before a document exists');
    gen();
    const snap=state().snapshot;
    assert.ok(snap,'generation freezes a snapshot');

    // The split holds together: nothing invented, nothing lost.
    const summary=c.summarizeInvoiceLineItems(c.listInvoiceLineItemsByInvoiceId(c.lilInvoiceForMonth_('2026-08').id));
    assert.equal(snap.fees_ex_gst,summary.totalAmount);
    assert.equal(snap.gst,summary.gstAmount);
    assert.equal(snap.invoice_total,summary.totalWithGst);
    assert.equal(snap.super,c.roundMoney_(snap.fees_ex_gst*snap.super_rate),'super is the guarantee rate on fees');
    assert.equal(snap.taxable_profit,c.roundMoney_(snap.fees_ex_gst-snap.super),'super is deductible before tax');
    // Tax is the app's own monthly PAYG estimate, on the same taxable income every Tempus screen uses.
    assert.equal(snap.tax_method,'payg_monthly');
    assert.equal(snap.tax,c.roundMoney_(c.estimateTax(snap.taxable_profit,'2026-08-01')),'reuses estimateTax');
    assert.equal(snap.tax_financial_year,'2026-27','the table is chosen by the month invoiced');
    // The identity the monthly transfer split asserts: her income is taxable profit less tax.
    assert.equal(snap.income,c.roundMoney_(snap.taxable_profit-snap.tax));
    // GST, tax and super are the business account's; the invoice splits into exactly two parts.
    assert.equal(snap.retained_in_business,c.roundMoney_(snap.gst+snap.tax+snap.super));
    assert.equal(c.roundMoney_(snap.income+snap.retained_in_business),snap.invoice_total,'the split never leaks');
    assert.ok(snap.income<snap.invoice_total,'she never takes the whole invoice');

    // Logging time must NOT put the figures out of date.
    const report=env.report;
    c.api_upsertAssessmentTimeEntry({assessment_id:first.id,client_request_id:'t-1',hour_type_id:report.id,date:'2026-09-03',hours:2});
    let after=state();
    assert.equal(after.stale,false,'logging time leaves the snapshot current');
    assert.deepEqual(after.snapshot,snap,'and leaves its values untouched');

    // Adding an assessment does.
    const second=create({assessment_date:'2026-08-11',assessment_type_id:'standard',client_name:'Grace Hopper'});
    after=state();
    assert.equal(after.stale,true,'a new assessment makes the figures out of date');
    assert.deepEqual(after.snapshot,snap,'the frozen values are kept until a new invoice is generated');

    // Changing a type does too, and regenerating refreshes the figures.
    gen();
    const twoAssessments=state().snapshot;
    assert.equal(state().stale,false);
    assert.ok(twoAssessments.income>snap.income,'a second assessment raises what is hers');
    const decorated=c.api_getAssessmentsForMonth(2026,8).assessments.find(a=>a.id===second.id);
    c.api_upsertAssessment({id:second.id,request_id:'retype',expected_revision:decorated.revision,
      assessment_date:'2026-08-11',contract_id:contract.id,assessment_type_id:'enhanced',
      organisation:'Northbridge',percentage_adjustment:0,client_name:'Grace Hopper',client_dob:'1906-12-09'});
    assert.equal(state().stale,true,'a type change makes the figures out of date');
    gen();
    const enhanced=state().snapshot;
    assert.equal(state().stale,false);
    assert.ok(enhanced.income>twoAssessments.income,'Enhanced adds a document review line, so more is hers');
    assert.equal(c.roundMoney_(enhanced.income+enhanced.retained_in_business),enhanced.invoice_total);

    // A quiet month is taxed as a quiet month, the same way the rest of Tempus taxes a month.
    const quiet=c.lilInvoiceSnapshot_([{amount:1000,gst_amount:100,gst_rate:0.1}],'2026-08');
    const busy=c.lilInvoiceSnapshot_([{amount:20000,gst_amount:2000,gst_rate:0.1}],'2026-08');
    assert.ok(quiet.tax/quiet.taxable_profit < busy.tax/busy.taxable_profit,'a lighter month carries a lower effective rate');
    [quiet,busy].forEach(one=>assert.equal(c.roundMoney_(one.income+one.retained_in_business),one.invoice_total,'the split still balances'));
    assert.ok(drive.count>0);
  });
  test('invoice numbers are YYMMNNN for the month covered, and the file is named for it',()=>{
    const env=lilContext(),c=env.context,create=env.create;
    const drive=mockDrive(c);
    // Generated in September, covering August: the number must follow the assessments, not the clock.
    c.assessmentToday_=()=>'2026-09-02';
    create({assessment_date:'2026-08-04',client_name:'Ada Lovelace'});
    const first=c.api_generateLilMonthlyInvoice({year:2026,month:8,request_id:'n1',
      expected_hash:c.lilInvoiceInputs_('2026-08').hash}).invoice;
    assert.equal(first.invoice_number,'2608001','YYMMNNN with no dashes');
    assert.match(first.invoice_number,/^\d{7}$/);
    assert.equal(first.invoice_date,'2026-09-02','the invoice date is still the generation date');
    assert.equal(first.source_month,'2026-08');
    assert.equal(first.year,2026);assert.equal(first.month,8,'identity follows the period, not the clock');
    assert.equal(c.buildInvoiceFilename(first),'Invoice 2608001 - 08-26');

    // Regenerating keeps the number and the id, so payment references survive.
    const again=c.api_generateLilMonthlyInvoice({year:2026,month:8,request_id:'n2',
      expected_hash:c.lilInvoiceInputs_('2026-08').hash,confirmed_document_id:first.generated_doc_id}).invoice;
    assert.equal(again.invoice_number,'2608001');
    assert.equal(again.id,first.id);

    // A second month gets its own number, and its own 001.
    create({assessment_date:'2026-09-08',client_name:'Grace Hopper'});
    const september=c.api_generateLilMonthlyInvoice({year:2026,month:9,request_id:'n3',
      expected_hash:c.lilInvoiceInputs_('2026-09').hash}).invoice;
    assert.equal(september.invoice_number,'2609001','each month restarts at 001');
    assert.equal(c.buildInvoiceFilename(september),'Invoice 2609001 - 09-26');

    // January of the next calendar year, to check the year boundary.
    create({assessment_date:'2027-01-12',client_name:'Edith Clarke'});
    const january=c.api_generateLilMonthlyInvoice({year:2027,month:1,request_id:'n4',
      expected_hash:c.lilInvoiceInputs_('2027-01').hash}).invoice;
    assert.equal(january.invoice_number,'2701001');
    assert.equal(c.buildInvoiceFilename(january),'Invoice 2701001 - 01-27');

    // An invoice numbered in the old dashed format is rewritten in place on its next generation,
    // keeping its id so payments and reporting references are untouched.
    c.assessmentWrite_('invoices',{id:first.id,invoice_number:'2026-08-001',year:2026,month:9,sequence:1});
    c.clearInvoiceCaches();
    const renumbered=c.api_generateLilMonthlyInvoice({year:2026,month:8,request_id:'n5',
      expected_hash:c.lilInvoiceInputs_('2026-08').hash,confirmed_document_id:again.generated_doc_id}).invoice;
    assert.equal(renumbered.invoice_number,'2608001','a legacy dashed number is normalised');
    assert.equal(renumbered.id,first.id,'without changing the invoice identity');
    assert.equal(renumbered.month,8,'and the period identity is corrected too');
    assert.ok(!c.buildInvoiceFilename(renumbered).includes('/'),'no slash in a Drive filename');
    assert.ok(drive.count>0);
  });
  test('unused template line rows are removed so the invoice does not spill onto another page',()=>{
    const env=lilContext(),c=env.context,create=env.create;
    const drive=mockDrive(c);
    create({assessment_date:'2026-08-04',assessment_type_id:'standard',client_name:'Ada Lovelace'});
    create({assessment_date:'2026-08-11',assessment_type_id:'enhanced',client_name:'Grace Hopper'});
    const invoice=c.api_generateLilMonthlyInvoice({year:2026,month:8,request_id:'rows',
      expected_hash:c.lilInvoiceInputs_('2026-08').hash}).invoice;
    const file=drive.files.get(invoice.generated_doc_id);
    const rows=file.blocks.filter(b=>b.kind==='row');

    // Standard bills one line, Enhanced two: three filled rows, plus the header and the totals row.
    assert.equal(rows.length,5,'the 15 unused rows are gone, not blanked: '+rows.length+' rows remain');
    assert.equal(rows[0].text,'Date | Service Description | Amount','the header row survives');
    assert.match(rows[rows.length-1].text,/^Subtotal: \$/,'the totals row survives and is filled');

    // Nothing is left half-rendered.
    assert.ok(!/\{\{/.test(file.text),'no placeholder survives anywhere: '+(file.text.match(/\{\{[^}]*\}\}/g)||[]).join(','));
    assert.match(rows[1].text,/^04\/08\/2026 \| [\s\S]*Ada Lovelace/);
    assert.match(rows[2].text,/^11\/08\/2026 \| [\s\S]*Grace Hopper/);
    assert.equal(rows[3].text.split(' | ')[0],'','the second Enhanced line repeats no date');

    // A month that fills the template keeps every row.
    const full=lilContext(),fc=full.context,fd=mockDrive(fc);
    for(let i=1;i<=18;i++) full.create({assessment_date:'2026-08-'+String(i).padStart(2,'0'),assessment_type_id:'standard',client_name:'Client '+i});
    const packed=fc.api_generateLilMonthlyInvoice({year:2026,month:8,request_id:'full',
      expected_hash:fc.lilInvoiceInputs_('2026-08').hash}).invoice;
    const packedRows=fd.files.get(packed.generated_doc_id).blocks.filter(b=>b.kind==='row');
    assert.equal(packedRows.length,20,'18 lines plus header and totals');
    assert.ok(!/\{\{/.test(fd.files.get(packed.generated_doc_id).text));

    // A limit set below the template's capacity must still leave no stray placeholders behind.
    const low=lilContext(),lc=low.context,ld=mockDrive(lc);
    lc.api_updateSettings({invoice_line_item_limit:5});
    low.create({assessment_date:'2026-08-04',assessment_type_id:'standard',client_name:'Ada Lovelace'});
    const capped=lc.api_generateLilMonthlyInvoice({year:2026,month:8,request_id:'low',
      expected_hash:lc.lilInvoiceInputs_('2026-08').hash}).invoice;
    const cappedFile=ld.files.get(capped.generated_doc_id);
    assert.ok(!/\{\{/.test(cappedFile.text),'slots past the configured limit are cleared too: '+(cappedFile.text.match(/\{\{[^}]*\}\}/g)||[]).join(','));
    assert.equal(cappedFile.blocks.filter(b=>b.kind==='row').length,3,'one line, header, totals');
    assert.ok(drive.count>0);
  });
  test('business expenses reduce what is hers, and an unsaved PAYG rate cannot look saved',()=>{
    const env=lilContext(),c=env.context,create=env.create;
    const drive=mockDrive(c);
    c.updateSettingsUnlocked_({accounting_basis:'accrual'});
    create({assessment_date:'2026-08-04',assessment_type_id:'standard',client_name:'Ada Lovelace'});
    const gen=()=>c.api_generateLilMonthlyInvoice({year:2026,month:8,request_id:'e-'+Math.random(),
      expected_hash:c.lilInvoiceInputs_('2026-08').hash,
      confirmed_document_id:(c.lilInvoiceForMonth_('2026-08')||{}).generated_doc_id||''}).invoice;
    const snapshot=()=>c.api_getAssessmentsForMonth(2026,8).invoice.snapshot;

    c.expenseActualForPeriod_=()=>({purchases:0,gst:0});
    gen();
    const clean=snapshot();
    assert.equal(clean.expenses_paid,0);
    assert.equal(clean.net_gst,clean.gst,'with no costs, net GST is the invoice GST');
    assert.equal(clean.tax_method,'payg_monthly');

    // The same invoice with a month of business costs.
    c.expenseActualForPeriod_=()=>({purchases:110,gst:10});
    gen();
    const withCosts=snapshot();
    assert.equal(withCosts.expenses_paid,110,'the month’s costs are recorded');
    assert.equal(withCosts.expenses_ex_gst,100);
    assert.equal(withCosts.net_gst,c.roundMoney_(withCosts.gst-10),'GST already claimed back nets off');
    // Costs come off before super and tax, as the transfer split orders them.
    assert.equal(withCosts.profit_before_super,c.roundMoney_(withCosts.fees_ex_gst-100));
    assert.equal(withCosts.super,c.roundMoney_(withCosts.profit_before_super*withCosts.super_rate));
    assert.ok(withCosts.super<clean.super,'less profit means less super');
    assert.equal(withCosts.taxable_profit,c.roundMoney_(withCosts.profit_before_super-withCosts.super));
    // Costs reduce taxable income, so they reduce the tax with it. The fixture's single $800
    // assessment is under the tax-free threshold either way, so the reduction is shown at a realistic
    // month alongside the exact-value check.
    assert.equal(withCosts.tax,c.roundMoney_(c.estimateTax(withCosts.taxable_profit,'2026-08-01')));
    assert.ok(withCosts.tax<=clean.tax);
    c.expenseActualForPeriod_=()=>({purchases:0,gst:0});
    const bigClean=c.lilInvoiceSnapshot_([{amount:11741.50,gst_amount:1174.15,gst_rate:0.1}],'2026-08');
    c.expenseActualForPeriod_=()=>({purchases:1100,gst:100});
    const bigCosts=c.lilInvoiceSnapshot_([{amount:11741.50,gst_amount:1174.15,gst_rate:0.1}],'2026-08');
    assert.ok(bigCosts.tax<bigClean.tax,'a real month shows costs reducing the tax');
    assert.ok(bigCosts.income<bigClean.income,'and reducing what she can transfer');
    c.expenseActualForPeriod_=()=>({purchases:110,gst:10});
    // Expenses join what stays in the business, and the split still balances exactly.
    assert.equal(withCosts.retained_in_business,c.roundMoney_(withCosts.net_gst+withCosts.tax+withCosts.super+110));
    assert.equal(withCosts.income,c.roundMoney_(withCosts.taxable_profit-withCosts.tax),'the split identity holds');
    assert.equal(c.roundMoney_(withCosts.income+withCosts.retained_in_business),withCosts.invoice_total,'nothing leaks');
    assert.ok(withCosts.income<clean.income,'costs reduce what she can transfer');
    assert.deepEqual(withCosts.warnings,[]);

    // Costs beyond the invoice say so rather than reporting a negative transfer silently.
    c.expenseActualForPeriod_=()=>({purchases:99000,gst:9000});
    gen();
    const underwater=snapshot();
    assert.ok(underwater.income<0);
    assert.equal(underwater.super,0,'super never goes negative on a loss');
    assert.ok(underwater.tax>=0,'nor does the tax provision');
    assert.ok(underwater.warnings.some(w=>/nothing to transfer/.test(w)));
    assert.equal(c.roundMoney_(underwater.income+underwater.retained_in_business),underwater.invoice_total,'still balances');

    // Taxable income is exactly fees - costs - super, with costs net of their GST credits.
    assert.equal(withCosts.taxable_profit,
      c.roundMoney_(withCosts.fees_ex_gst - withCosts.expenses_ex_gst - withCosts.super),
      'taxable income is fees ex GST, less costs ex GST, less super');
    assert.ok(drive.count>0);
  });
  test('a settings field cannot display a value it never saved',()=>{
    // The PAYG rate field rendered String(val || 2) and read back parseFloat(el.value) || 2, so it
    // showed 2 whether or not anything was stored — and because captureSettingsState captured that
    // same 2, the form never went dirty, so the rate on screen could not be saved. The invoice
    // snapshot no longer reads this setting, but the BAS transfer split still does.
    const client=fs.readFileSync(path.join(__dirname,'../views/partials/scripts.html'),'utf8');
    const entry=client.slice(client.indexOf('payg_instalment_rate: {'));
    // Close on the registry entry's own indent: setValue's arrow body contains a "}," of its own.
    const block=entry.slice(0,entry.indexOf('\n    },'));
    assert.ok(!/parseFloat\(el\.value\) \|\| 2/.test(block),'an empty field must not read back as 2');
    assert.ok(!/String\(val \|\| 2\)/.test(block),'an unsaved rate must not render as 2');
    assert.match(block,/defaultValue: ''/);
    const settingsHtml=fs.readFileSync(path.join(__dirname,'../views/partials/settings.html'),'utf8');
    assert.match(settingsHtml,/id="set-payg-rate" placeholder="2"/,'the 2 survives as a placeholder hint');

    // Same bug, same fix: the logo shortcut defaulted its control to 'time', and the settings save
    // copies every control's value into state.settings and the cache — so saving anything wrote a
    // 'time' choice nobody made, which then beat the mode-aware default and sent the logo back to
    // Time Entry in Lil mode.
    const brand=client.slice(client.indexOf('brand_shortcut_target: {'));
    const brandBlock=brand.slice(0,brand.indexOf('\n    },'));
    assert.ok(!/el\.value = val \|\| 'time'/.test(brandBlock),'an unchosen shortcut must not render as Time Entry');
    assert.match(brandBlock,/defaultValue: ''/);
    assert.match(settingsHtml,/<option value="">Default for this mode<\/option>/,'"not chosen" is selectable');
    // And the resolution still falls back by mode.
    assert.match(client,/brand_shortcut_target\) \|\| \(lilMode \? 'assessments' : 'time'\)/);

    // The split still reads it, so an unset rate must still mean "unset" there.
    const {context:c}=lilContext();
    c.api_getSettings=()=>({});
    c.listBasSubmissionsInternal=()=>[];
    assert.equal(c.resolvePaygInstalmentRate_(),null,'nothing stored still means no rate for the BAS split');
    c.api_getSettings=()=>({payg_instalment_rate:30});
    assert.equal(c.resolvePaygInstalmentRate_(),0.3,'and a saved 30 still reads as 30%');
  });
}};
