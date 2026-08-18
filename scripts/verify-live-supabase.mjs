const SUPABASE_URL = 'https://umtgfaqjoqbsdzwpqizq.supabase.co';
const API_KEY = 'sb_publishable_VDRpIj8lD9AX90tylt-WYw_pV7QAIsw';

const headers = {
  apikey: API_KEY,
  Authorization: `Bearer ${API_KEY}`,
};

async function checkEndpoint(path) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
    const json = await res.json();
    return { status: res.status, ok: res.ok, data: json };
  } catch (err) {
    return { status: 500, ok: false, error: err.message };
  }
}

async function main() {
  console.log('===========================================================');
  console.log('VERIFYING BUSINESS CODE COLUMNS ON LIVE SUPABASE (REST)');
  console.log('Project Ref: umtgfaqjoqbsdzwpqizq');
  console.log('===========================================================');

  const columnsToCheck = [
    { table: 'profiles', select: 'account_code,role,account_status' },
    { table: 'employee_profiles', select: 'employee_code,job_title,employment_status' },
    { table: 'client_companies', select: 'client_code,code,name' },
    { table: 'departments', select: 'department_code,name' },
    { table: 'teams', select: 'team_code,name' },
    { table: 'services', select: 'service_code,name' },
    { table: 'projects', select: 'project_code,name,status' },
    { table: 'tasks', select: 'task_code,title,status' },
    { table: 'contracts', select: 'contract_code,contract_number,title' },
    { table: 'invoices', select: 'invoice_code,invoice_number,amount' },
    { table: 'invoice_payments', select: 'payment_code,amount' },
    { table: 'leave_requests', select: 'leave_code,status' },
    { table: 'attendance_records', select: 'attendance_code,attendance_date' },
    { table: 'account_approval_events', select: 'approval_event_code,action' },
  ];

  for (const c of columnsToCheck) {
    const res = await checkEndpoint(`${c.table}?select=${c.select}&limit=3`);
    if (res.ok) {
      console.log(`[PASS] ${c.table}: column query OK. Status: ${res.status}`);
    } else {
      console.error(`[FAIL] ${c.table}:`, res.data);
    }
  }

  console.log('\n===========================================================');
  console.log('VERIFYING ALL 13 ADMIN READABLE VIEWS ON LIVE SUPABASE');
  console.log('===========================================================');

  const views = [
    'admin_account_approval_events',
    'admin_clients',
    'admin_people',
    'admin_departments',
    'admin_teams',
    'admin_projects',
    'admin_tasks',
    'admin_attendance_records',
    'admin_leave_requests',
    'admin_contracts',
    'admin_invoices',
    'admin_payments',
    'admin_services',
  ];

  for (const v of views) {
    const res = await checkEndpoint(`${v}?select=*&limit=3`);
    if (res.ok) {
      console.log(`[PASS] View ${v}: query OK. Status: ${res.status}`);
    } else {
      console.error(`[FAIL] View ${v}:`, res.data);
    }
  }
}

main().catch(console.error);
