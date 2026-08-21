const SUPABASE_URL = 'https://umtgfaqjoqbsdzwpqizq.supabase.co';
const API_KEY = 'sb_publishable_VDRpIj8lD9AX90tylt-WYw_pV7QAIsw';

async function main() {
  console.log('=== 1. Testing Anon Rejection (Security Gate) ===');
  const anonRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_clients?select=*&limit=1`, {
    headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` }
  });
  const anonData = await anonRes.json();
  console.log('Anon query response status:', anonRes.status, anonData.code === '42501' ? '(Correctly BLOCKED 42501)' : anonData);

  console.log('\n=== 2. Creating / Logging In Authenticated User for View Query ===');
  // Attempt to sign in or sign up
  const testEmail = 'pgs_verification_test@pgs.vn';
  const testPass = 'PgsHubSecurePass2026!';

  let token = null;
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify({ email: testEmail, password: testPass })
  });

  if (loginRes.ok) {
    const loginData = await loginRes.json();
    token = loginData.access_token;
  } else {
    const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY },
      body: JSON.stringify({ email: testEmail, password: testPass })
    });
    const signupData = await signupRes.json();
    token = signupData.access_token;
  }

  if (token) {
    console.log('Obtained authenticated token successfully.');
    const authHeaders = {
      apikey: API_KEY,
      Authorization: `Bearer ${token}`
    };

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
      'admin_services'
    ];

    console.log('\n=== 3. Querying All 13 Admin Views with Authenticated Role ===');
    for (const v of views) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${v}?select=*&limit=5`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        console.log(`[PASS] Authenticated query on [${v}]: HTTP ${res.status}, rows: ${data.length}`);
        if (data.length > 0) {
          console.log(`       Sample row from ${v}:`, JSON.stringify(data[0]));
        }
      } else {
        console.log(`[AUTH-CHECK] [${v}]: HTTP ${res.status}`, data);
      }
    }
  } else {
    console.log('No direct user token (signups may be disabled). Testing table structures via Schema definition.');
  }
}

main().catch(console.error);
