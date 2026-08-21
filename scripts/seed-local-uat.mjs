import pg from "pg";
import { assertConfirmedDisposableLocalDatabaseUrl } from "./lib/local-endpoint-guard.mjs";
const { Client } = pg;

const DATABASE_URL = "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres";

assertConfirmedDisposableLocalDatabaseUrl(DATABASE_URL);

const client = new Client({ connectionString: DATABASE_URL });

const USERS = [
  { id: "00000000-0000-4000-8000-000000000001", email: "admin@test.local", role: "admin", full_name: "UAT Admin Local" },
  { id: "00000000-0000-4000-8000-000000000002", email: "leader@test.local", role: "team_leader", full_name: "UAT Leader Local" },
  { id: "00000000-0000-4000-8000-000000000003", email: "employee@test.local", role: "employee", full_name: "UAT Employee Local" },
  { id: "00000000-0000-4000-8000-000000000004", email: "accountant@test.local", role: "accountant", full_name: "UAT Accountant Local" },
  { id: "00000000-0000-4000-8000-000000000005", email: "client@test.local", role: "client", full_name: "UAT Client Local" },
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

  // System Settings: Office Address
  console.log("Configuring approved business settings and canonical attendance policy...");
  await client.query(`
    INSERT INTO public.system_settings (key, category, description, value)
    VALUES
      (
        'company_info', 'general', 'Company information and office coordinates',
        jsonb_build_object(
          'name', 'PGS Agency',
          'address', 'Tầng 2, DM 2-25, Điểm TTCN làng nghề dệt lụa Vạn Phúc, Hà Đông, Hà Nội',
          'office_lat', 20.9768,
          'office_lng', 105.7725,
          'allowed_radius_meters', 100
        )
      )
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      category = EXCLUDED.category,
      updated_at = now();
  `);

  const attendanceSettings = await client.query(`
    UPDATE public.attendance_settings
    SET timezone = 'Asia/Ho_Chi_Minh',
        workday_start_time = '08:00:00',
        workday_end_time = '17:30:00',
        late_grace_minutes = 5,
        early_leave_grace_minutes = 5,
        location_required = true,
        location_radius_meters = 100,
        office_latitude = 20.9768,
        office_longitude = 105.7725,
        updated_at = now()
    WHERE id = (
      SELECT id FROM public.attendance_settings
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    )
    RETURNING id;
  `);
  if (attendanceSettings.rowCount !== 1) {
    throw new Error("Expected exactly one canonical attendance_settings row.");
  }

  // Departments & Employee Profiles
  console.log("Setting up Department & Employee Profiles...");
  const deptRes = await client.query(`
    INSERT INTO public.departments (name, description, created_by, updated_by)
    VALUES ('Phòng Kỹ Thuật & Phần Mềm', 'Phòng phát triển giải pháp số PGS', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
    RETURNING id;
  `);
  const deptId = deptRes.rows[0]?.id;

  const leaderUser = USERS.find(u => u.role === 'team_leader');
  const teamRes = await client.query(`
    INSERT INTO public.teams (
      department_id, code, name, leader_user_id, description, created_by, updated_by
    ) VALUES ($1, 'UAT_ENG', 'Đội Kỹ Thuật UAT', $2, 'Đội kiểm thử chấm công UAT', $3, $3)
    ON CONFLICT (department_id, code) DO UPDATE SET
      leader_user_id = EXCLUDED.leader_user_id,
      name = EXCLUDED.name,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
    RETURNING id;
  `, [deptId, leaderUser.id, adminUser.id]);
  const teamId = teamRes.rows[0]?.id;

  for (const role of ['admin', 'team_leader', 'employee', 'accountant']) {
    const user = USERS.find(u => u.role === role);
    await client.query(`
      INSERT INTO public.employee_profiles (user_id, department_id, team_id, job_title)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        department_id = EXCLUDED.department_id,
        team_id = EXCLUDED.team_id,
        job_title = EXCLUDED.job_title;
    `, [
      user.id,
      deptId,
      role === 'team_leader' || role === 'employee' ? teamId : null,
      role.toUpperCase(),
    ]);
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
