'use strict';

const { getSupabaseClient } = require('../integrations/supabaseClient');

function clean(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function getSystem(contractNo) {
  const text = clean(contractNo).toUpperCase();

  if (text.startsWith('CSR')) return 'CSR';
  if (text.startsWith('ECR')) return 'ECR';
  if (text.startsWith('MV')) return 'MV';
  if (text.startsWith('BN')) return 'BN';
  if (text.startsWith('KK')) return 'KK';

  return '';
}

function getMonth(date) {
  const text = clean(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.slice(0, 7) : '';
}

function toNumber(value) {
  const number = Number(String(value || 0).replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function toDbCase(data) {
  const contractNo = clean(data.contractNo).toUpperCase();

  return {
    date: clean(data.date),
    month: getMonth(data.date),
    system: getSystem(contractNo),

    loan_approval: clean(data.loanApproval),
    doc_approval: clean(data.docApproval),
    close_approval: clean(data.closeApproval),

    shop: clean(data.shop),
    province: clean(data.province),

    contract_no: contractNo,
    price: toNumber(data.price),
    note: clean(data.note),
    case_status: clean(data.caseStatus),

    loan_evidence_url: clean(data.loanEvidence),
    doc_evidence_url: clean(data.docEvidence),
    close_evidence_url: clean(data.closeEvidence),

    case_received_at: clean(data.caseReceivedAt),
    loan_completed_at: clean(data.loanCompletedAt),
    doc_completed_at: clean(data.docCompletedAt),
    close_completed_at: clean(data.closeCompletedAt),

    sla_minutes: Number(data.slaMinutes || 20),
    sla_status: clean(data.slaStatus),
    tat_minutes: toNumber(data.tatMinutes),

    sheet_sync_status: data.sheetSyncStatus || 'pending'
  };
}

function fromDbCase(row) {
  if (!row) return null;

  return {
    id: row.id,
    row: row.id,

    date: row.date || '',
    month: row.month || '',
    system: row.system || '',

    loanApproval: row.loan_approval || '',
    docApproval: row.doc_approval || '',
    closeApproval: row.close_approval || '',

    shop: row.shop || '',
    province: row.province || '',

    contractNo: row.contract_no || '',
    price: Number(row.price || 0),
    note: row.note || '',
    caseStatus: row.case_status || '',

    loanEvidence: row.loan_evidence_url || '',
    docEvidence: row.doc_evidence_url || '',
    closeEvidence: row.close_evidence_url || '',

    caseReceivedAt: row.case_received_at || '',
    loanCompletedAt: row.loan_completed_at || '',
    docCompletedAt: row.doc_completed_at || '',
    closeCompletedAt: row.close_completed_at || '',

    slaMinutes: row.sla_minutes || 20,
    slaStatus: row.sla_status || '',
    tatMinutes: row.tat_minutes ?? '',

    sheetSyncStatus: row.sheet_sync_status || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function upsertCase(data) {
  const supabase = getSupabaseClient();
  const payload = toDbCase(data);

  if (!payload.date) throw new Error('Missing date');
  if (!payload.contract_no) throw new Error('Missing contractNo');
  if (!payload.shop) throw new Error('Missing shop');

  const { data: row, error } = await supabase
    .from('cases')
    .upsert(payload, { onConflict: 'contract_no' })
    .select()
    .single();

  if (error) throw error;

  return fromDbCase(row);
}

async function listCases(limit = 1000) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map(fromDbCase);
}

async function findCaseByContract(contractNo) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('contract_no', clean(contractNo).toUpperCase())
    .maybeSingle();

  if (error) throw error;

  return fromDbCase(data);
}

async function deleteCaseByContract(contractNo) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('cases')
    .delete()
    .eq('contract_no', clean(contractNo).toUpperCase())
    .select()
    .maybeSingle();

  if (error) throw error;

  return fromDbCase(data);
}

module.exports = {
  upsertCase,
  listCases,
  findCaseByContract,
  deleteCaseByContract,
  fromDbCase
};