import pg from "pg";
const { Client } = pg;

const DATABASE_URL = "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres";

if (DATABASE_URL.includes("umtgfaqjoqbsdzwpqizq") || DATABASE_URL.includes("supabase.co")) {
  console.error("FAIL FAST: Remote production guard triggered!");
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

const USERS = [
  { id: "00000000-0000-4000-8000-000000000001", email: "uat.admin.local@pgs.test", role: "admin", full_name: "UAT Admin Local" },
  { id: "00000000-0000-4000-8000-000000000002", email: "uat.leader.local@pgs.test", role: "team_leader", full_name: "UAT Leader Local" },
  { id: "00000000-0000-4000-8000-000000000003", email: "uat.employee.local@pgs.test", role: "employee", full_name: "UAT Employee Local" },
  { id: "00000000-0000-4000-8000-000000000004", email: "uat.accountant.local@pgs.test", role: "accountant", full_name: "UAT Accountant Local" },
  { id: "00000000-0000-4000-8000-000000000005", email: "uat.client.local@pgs.test", role: "client", full_name: "UAT Client Local" },
];

async function seed() {
  await client.connect();
  console.log("Connected to local database. Seeding synthetic UAT identities...");

  const adminUser = USERS.find(u => u.role === "admin");

  for (const u of USERS) {
    // Insert into auth.users (password: Password123! - hashed via pgcrypto bcrypt)
    await client.query(`
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role
      ) VALUES (
        $1, '00000000-0000-0000-0000-000000000000', $2,
        extensions.crypt('Password123!', extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', $3::text, 'role', $4::text),
        now(), now(), 'authenticated', 'authenticated'
      ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        encrypted_password = EXCLUDED.encrypted_password,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data;
    `, [u.id, u.email, u.full_name, u.role]);

    console.log(`Created auth user: ${u.email} (${u.role}) -> ${u.id}`);
  }

  // Bootstrap Admin
  try {
    await client.query(`SELECT public.bootstrap_initial_admin($1::uuid)`, [adminUser.id]);
    console.log("Bootstrapped initial admin successfully");
  } catch (e) {
    if (e.message.includes("System already has bootstrapped admin account")) {
      console.log("Admin account was already bootstrapped");
    } else {
      throw e;
    }
  }

  // Approve remaining users
  for (const u of USERS) {
    if (u.role !== "admin") {
      try {
        await client.query(`SELECT public.approve_pending_account($1::uuid, $2::uuid, $3::public.app_role)`, [
          adminUser.id,
          u.id,
          u.role
        ]);
        console.log(`Approved user ${u.email} as ${u.role}`);
      } catch (e) {
        if (e.message.includes("Target account is not pending approval")) {
          console.log(`User ${u.email} is already approved as active`);
        } else {
          throw e;
        }
      }
    }
  }

  // System Settings: Office Address + Work Hours
  console.log("Configuring approved business settings (timezone, work hours, office geo)...");
  await client.query(`
    INSERT INTO public.system_settings (key, category, description, value)
    VALUES
      (
        'company_info', 'general', 'Company information and office coordinates',
        jsonb_build_object(
          'company_name', 'PGS Agency Hub',
          'address', 'Tầng 2, DM 2-25, Điểm TTCN làng nghề dệt lụa Vạn Phúc, Hà Đông, Hà Nội',
          'office_lat', 20.9768,
          'office_lng', 105.7725,
          'allowed_radius_meters', 100
        )
      ),
      (
        'work_hours', 'attendance', 'Company standard work hours and boundary thresholds',
        jsonb_build_object(
          'timezone', 'Asia/Ho_Chi_Minh',
          'workday_start_time', '08:00',
          'workday_end_time', '17:30',
          'late_grace_minutes', 5,
          'early_leave_grace_minutes', 5,
          'late_threshold_time', '08:06',
          'early_leave_threshold_time', '17:25'
        )
      )
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      category = EXCLUDED.category,
      updated_at = now();
  `);

  // Departments & Employee Profiles
  console.log("Setting up Department & Employee Profiles...");
  const deptRes = await client.query(`
    INSERT INTO public.departments (name, description, created_by, updated_by)
    VALUES ('Phòng Kỹ Thuật & Phần Mềm', 'Phòng phát triển giải pháp số PGS', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
    RETURNING id;
  `);
  const deptId = deptRes.rows[0]?.id;

  for (const role of ['admin', 'team_leader', 'employee', 'accountant']) {
    const user = USERS.find(u => u.role === role);
    await client.query(`
      INSERT INTO public.employee_profiles (user_id, department_id, job_title)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        department_id = EXCLUDED.department_id,
        job_title = EXCLUDED.job_title;
    `, [user.id, deptId, role.toUpperCase()]);
  }

  // Client Company
  console.log("Creating Client Company and Membership...");
  const clientUser = USERS.find(u => u.role === 'client');
  const compRes = await client.query(`
    INSERT INTO public.client_companies (code, name, tax_code, address, created_by, updated_by)
    VALUES ('UAT_CLIENT_CO', 'Công Ty TNHH Thử Nghiệm PGS', '0109887766', 'Hà Nội', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id;
  `);
  const compId = compRes.rows[0].id;

  await client.query(`
    INSERT INTO public.client_memberships (user_id, client_company_id, title, is_primary, created_by)
    VALUES ($1, $2, 'Giám Đốc Đại Diện', true, '00000000-0000-4000-8000-000000000001')
    ON CONFLICT (client_company_id, user_id) DO NOTHING;
  `, [clientUser.id, compId]);

  // Project & Project Memberships
  console.log("Creating UAT Project...");
  const leaderUser = USERS.find(u => u.role === 'team_leader');
  const empUser = USERS.find(u => u.role === 'employee');

  const projRes = await client.query(`
    INSERT INTO public.projects (
      name, client_company_id, project_manager_user_id, status, description, created_by, updated_by
    ) VALUES (
      'Dự Án Phần Mềm UAT PGS Hub', $1, $2, 'active', 'Dự án thực hiện triển khai giải pháp quản trị số', $3, $3
    ) RETURNING id, project_code;
  `, [compId, leaderUser.id, adminUser.id]);
  const projId = projRes.rows[0].id;

  await client.query(`
    INSERT INTO public.project_memberships (project_id, user_id, project_role, created_by)
    VALUES
      ($1, $2, 'project_manager', $2),
      ($1, $3, 'project_manager', $2),
      ($1, $4, 'member', $2)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  `, [projId, adminUser.id, leaderUser.id, empUser.id]);

  // Project Service with real Service Catalog
  const serviceRes = await client.query(`SELECT id, name, service_code FROM public.services ORDER BY sort_order ASC LIMIT 1;`);
  const firstService = serviceRes.rows[0];
  console.log(`Using real service: ${firstService.service_code} - ${firstService.name}`);

  const projServRes = await client.query(`
    INSERT INTO public.project_services (project_id, service_id, status, created_by, updated_by)
    VALUES ($1, $2, 'active', $3, $3)
    RETURNING id, project_service_code;
  `, [projId, firstService.id, adminUser.id]);
  const projServiceId = projServRes.rows[0].id;

  console.log(`Created project service: ${projServRes.rows[0].project_service_code} (${projServiceId})`);

  console.log("=== LOCAL UAT SEED COMPLETE ===");
  await client.end();
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
