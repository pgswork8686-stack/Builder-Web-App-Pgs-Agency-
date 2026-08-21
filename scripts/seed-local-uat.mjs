import assert from "node:assert/strict";
import pg from "pg";

import {
  LOCAL_UAT,
  UAT_EMPLOYEE_USERS,
  UAT_USERS,
  UAT_USER_IDS,
} from "./lib/local-uat-fixtures.mjs";
import {
  assertConfirmedDisposableLocalDatabaseUrl,
  assertNoHostedSupabaseEnvironment,
} from "./lib/local-endpoint-guard.mjs";

const { Client } = pg;

assertNoHostedSupabaseEnvironment(process.env);

const DATABASE_URL =
  "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres";

assertConfirmedDisposableLocalDatabaseUrl(DATABASE_URL);

const client = new Client({ connectionString: DATABASE_URL });

function todayInTimezone(timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function getProfile(userId) {
  const result = await client.query(
    `
      SELECT id, email, full_name, role::text AS role,
             account_status::text AS account_status
      FROM public.profiles
      WHERE id = $1::uuid
    `,
    [userId],
  );
  assert.equal(
    result.rowCount,
    1,
    "Every seeded Auth user must have a profile.",
  );
  return result.rows[0];
}

async function seedAuthUsers() {
  for (const user of UAT_USERS) {
    await client.query(
      `
        INSERT INTO auth.users (
          id,
          instance_id,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at,
          aud,
          role
        ) VALUES (
          $1::uuid,
          '00000000-0000-0000-0000-000000000000'::uuid,
          $2,
          extensions.crypt($3, extensions.gen_salt('bf')),
          now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', $4::text),
          now(),
          now(),
          'authenticated',
          'authenticated'
        )
        ON CONFLICT (id) DO UPDATE
        SET instance_id = EXCLUDED.instance_id,
            email = EXCLUDED.email,
            encrypted_password = EXCLUDED.encrypted_password,
            email_confirmed_at = EXCLUDED.email_confirmed_at,
            raw_app_meta_data = EXCLUDED.raw_app_meta_data,
            raw_user_meta_data = EXCLUDED.raw_user_meta_data,
            created_at = COALESCE(auth.users.created_at, EXCLUDED.created_at),
            aud = EXCLUDED.aud,
            role = EXCLUDED.role,
            updated_at = now()
      `,
      [user.id, user.email, LOCAL_UAT.password, user.fullName],
    );

    // GoTrue password login requires an email identity as well as auth.users.
    // Direct fixture setup intentionally creates both records so local UAT
    // exercises real Supabase Auth sessions rather than a DB-only facade.
    await client.query(
      `
        INSERT INTO auth.identities (
          id,
          provider_id,
          user_id,
          identity_data,
          provider,
          last_sign_in_at,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          $1::text,
          $1::uuid,
          jsonb_build_object(
            'sub', $1::text,
            'email', $2::text,
            'email_verified', true,
            'phone_verified', false
          ),
          'email',
          now(),
          now(),
          now()
        )
        ON CONFLICT (provider_id, provider) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            identity_data = EXCLUDED.identity_data,
            updated_at = now()
      `,
      [user.id, user.email],
    );
  }
}

async function ensureAdminAccount() {
  const admin = LOCAL_UAT.users.admin;
  let profile = await getProfile(admin.id);

  if (profile.role === "admin" && profile.account_status === "active") {
    return;
  }

  const activeAdmins = await client.query(
    `
      SELECT id
      FROM public.profiles
      WHERE role = 'admin'::public.app_role
        AND account_status = 'active'::public.account_status
    `,
  );
  assert.equal(
    activeAdmins.rowCount,
    0,
    "The local UAT seed refuses to overwrite an unrelated active admin.",
  );
  assert.equal(
    profile.account_status,
    "pending",
    "The local UAT admin must be pending before bootstrap.",
  );

  await client.query(`SELECT public.bootstrap_initial_admin($1::uuid)`, [
    admin.id,
  ]);
  profile = await getProfile(admin.id);
  assert.equal(profile.role, "admin");
  assert.equal(profile.account_status, "active");
}

async function ensureApprovedAccounts() {
  const admin = LOCAL_UAT.users.admin;
  for (const user of UAT_USERS) {
    if (user.id === admin.id) continue;

    let profile = await getProfile(user.id);
    if (profile.role === user.role && profile.account_status === "active") {
      continue;
    }

    assert.equal(
      profile.account_status,
      "pending",
      `Fixture user ${user.email} must be pending before approval.`,
    );
    await client.query(
      `
        SELECT public.approve_pending_account(
          $1::uuid,
          $2::uuid,
          $3::public.app_role
        )
      `,
      [admin.id, user.id, user.role],
    );
    profile = await getProfile(user.id);
    assert.equal(profile.role, user.role);
    assert.equal(profile.account_status, "active");
  }
}

async function normalizeProfileDetails() {
  for (const user of UAT_USERS) {
    const result = await client.query(
      `
        UPDATE public.profiles
        SET email = $2,
            full_name = $3
        WHERE id = $1::uuid
        RETURNING id
      `,
      [user.id, user.email, user.fullName],
    );
    assert.equal(
      result.rowCount,
      1,
      "Fixture profile update must affect one row.",
    );
  }
}

async function normalizeAuthLoginFields() {
  // The local account-approval RPC updates auth metadata. Reassert the
  // GoTrue-required audience/role and empty token fields afterwards so the
  // synthetic identities can obtain real password sessions on every rerun.
  const result = await client.query(
    `
      UPDATE auth.users
      SET instance_id = '00000000-0000-0000-0000-000000000000'::uuid,
          aud = 'authenticated',
          role = 'authenticated',
          raw_app_meta_data =
            '{"provider":"email","providers":["email"]}'::jsonb,
          is_super_admin = false,
          is_anonymous = false,
          created_at = COALESCE(created_at, now()),
          confirmation_token = '',
          recovery_token = '',
          email_change_token_new = '',
          email_change_token_current = '',
          email_change = '',
          updated_at = now()
      WHERE id = ANY($1::uuid[])
      RETURNING id
    `,
    [UAT_USER_IDS],
  );
  assert.equal(
    result.rowCount,
    UAT_USERS.length,
    "Every local UAT Auth user must retain a real password-login surface.",
  );
}

async function configureCanonicalSettings() {
  const admin = LOCAL_UAT.users.admin;
  await client.query(
    `
      INSERT INTO public.system_settings (
        key,
        category,
        value,
        description,
        updated_by_user_id
      ) VALUES (
        'company_info',
        'general',
        jsonb_build_object(
          'name', $1::text,
          'address', 'Tầng 2, DM 2-25, Điểm TTCN làng nghề dệt lụa Vạn Phúc, Hà Đông, Hà Nội',
          'office_lat', $2::numeric,
          'office_lng', $3::numeric,
          'allowed_radius_meters', $4::numeric
        ),
        'Synthetic local UAT company information only.',
        $5::uuid
      )
      ON CONFLICT (key) DO UPDATE
      SET category = EXCLUDED.category,
          value = EXCLUDED.value,
          description = EXCLUDED.description,
          updated_by_user_id = EXCLUDED.updated_by_user_id
    `,
    [
      LOCAL_UAT.companyInfoName,
      LOCAL_UAT.office.latitude,
      LOCAL_UAT.office.longitude,
      LOCAL_UAT.office.radiusMeters,
      admin.id,
    ],
  );

  const settings = await client.query(
    `SELECT id FROM public.attendance_settings ORDER BY id ASC`,
  );
  assert.equal(
    settings.rowCount,
    1,
    "Local UAT requires exactly one canonical attendance settings row.",
  );

  const updated = await client.query(
    `
      UPDATE public.attendance_settings
      SET timezone = 'Asia/Ho_Chi_Minh',
          workday_start_time = '08:00:00',
          workday_end_time = '17:30:00',
          late_grace_minutes = 5,
          early_leave_grace_minutes = 5,
          location_required = true,
          photo_required = false,
          location_radius_meters = $2::numeric,
          office_latitude = $3::numeric,
          office_longitude = $4::numeric,
          updated_at = now()
      WHERE id = $1::uuid
      RETURNING id
    `,
    [
      settings.rows[0].id,
      LOCAL_UAT.office.radiusMeters,
      LOCAL_UAT.office.latitude,
      LOCAL_UAT.office.longitude,
    ],
  );
  assert.equal(updated.rowCount, 1);
}

async function upsertOrganizationFixture() {
  const {
    admin,
    leader,
    employee,
    accountant,
    client: clientUser,
    foreignEmployee,
  } = LOCAL_UAT.users;
  const { primary: primaryDepartment, foreign: foreignDepartment } =
    LOCAL_UAT.departments;
  const { managed: managedTeam, foreign: foreignTeam } = LOCAL_UAT.teams;
  const { primary: primaryCompany, foreign: foreignCompany } =
    LOCAL_UAT.companies;
  const { managed: managedProject, foreign: foreignProject } =
    LOCAL_UAT.projects;

  for (const department of [primaryDepartment, foreignDepartment]) {
    const result = await client.query(
      `
        INSERT INTO public.departments (
          id, code, department_code, name, description, is_active, created_by, updated_by
        ) VALUES (
          $1::uuid, $2, $2, $3, 'Synthetic local UAT department only.', true, $4::uuid, $4::uuid
        )
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active,
            updated_by = EXCLUDED.updated_by
        RETURNING id
      `,
      [department.id, department.code, department.name, admin.id],
    );
    assert.equal(result.rowCount, 1);
  }

  const teamRows = [
    {
      ...managedTeam,
      departmentId: primaryDepartment.id,
      leaderUserId: leader.id,
    },
    {
      ...foreignTeam,
      departmentId: foreignDepartment.id,
      leaderUserId: null,
    },
  ];
  for (const team of teamRows) {
    const result = await client.query(
      `
        INSERT INTO public.teams (
          id, department_id, code, team_code, name, leader_user_id, description,
          is_active, created_by, updated_by
        ) VALUES (
          $1::uuid, $2::uuid, $3, $3, $4, $5::uuid,
          'Synthetic local UAT team only.', true, $6::uuid, $6::uuid
        )
        ON CONFLICT (id) DO UPDATE
        SET department_id = EXCLUDED.department_id,
            name = EXCLUDED.name,
            leader_user_id = EXCLUDED.leader_user_id,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active,
            updated_by = EXCLUDED.updated_by
        RETURNING id
      `,
      [
        team.id,
        team.departmentId,
        team.code,
        team.name,
        team.leaderUserId,
        admin.id,
      ],
    );
    assert.equal(result.rowCount, 1);
  }

  const employeeRows = [
    {
      user: admin,
      departmentId: primaryDepartment.id,
      teamId: null,
      employeeCode: "NV_90",
      jobTitle: "UAT Administrator",
      reportsToUserId: null,
    },
    {
      user: leader,
      departmentId: primaryDepartment.id,
      teamId: managedTeam.id,
      employeeCode: "NV_91",
      jobTitle: "UAT Team Leader",
      reportsToUserId: admin.id,
    },
    {
      user: employee,
      departmentId: primaryDepartment.id,
      teamId: managedTeam.id,
      employeeCode: "NV_92",
      jobTitle: "UAT Employee",
      reportsToUserId: leader.id,
    },
    {
      user: accountant,
      departmentId: primaryDepartment.id,
      teamId: null,
      employeeCode: "NV_93",
      jobTitle: "UAT Accountant",
      reportsToUserId: admin.id,
    },
    {
      user: foreignEmployee,
      departmentId: foreignDepartment.id,
      teamId: foreignTeam.id,
      employeeCode: "NV_94",
      jobTitle: "UAT Foreign Employee",
      reportsToUserId: null,
    },
  ];
  for (const row of employeeRows) {
    const result = await client.query(
      `
        INSERT INTO public.employee_profiles (
          user_id, employee_code, department_id, team_id, job_title,
          reports_to_user_id, employment_status, joined_date, created_by, updated_by
        ) VALUES (
          $1::uuid, $2, $3::uuid, $4::uuid, $5, $6::uuid,
          'active'::public.employment_status, '2026-01-01', $7::uuid, $7::uuid
        )
        ON CONFLICT (user_id) DO UPDATE
        SET department_id = EXCLUDED.department_id,
            team_id = EXCLUDED.team_id,
            job_title = EXCLUDED.job_title,
            reports_to_user_id = EXCLUDED.reports_to_user_id,
            employment_status = EXCLUDED.employment_status,
            joined_date = EXCLUDED.joined_date,
            updated_by = EXCLUDED.updated_by
        RETURNING user_id
      `,
      [
        row.user.id,
        row.employeeCode,
        row.departmentId,
        row.teamId,
        row.jobTitle,
        row.reportsToUserId,
        admin.id,
      ],
    );
    assert.equal(result.rowCount, 1);
  }

  for (const company of [primaryCompany, foreignCompany]) {
    const result = await client.query(
      `
        INSERT INTO public.client_companies (
          id, code, client_code, name, tax_code, address, status, created_by, updated_by
        ) VALUES (
          $1::uuid, $2, $2, $3, NULL, 'Hà Nội', 'active'::public.client_status,
          $4::uuid, $4::uuid
        )
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            address = EXCLUDED.address,
            status = EXCLUDED.status,
            updated_by = EXCLUDED.updated_by
        RETURNING id
      `,
      [company.id, company.code, company.name, admin.id],
    );
    assert.equal(result.rowCount, 1);
  }

  const unrelatedPrimaryMembership = await client.query(
    `
      SELECT id
      FROM public.client_memberships
      WHERE user_id = $1::uuid
        AND is_primary = true
        AND client_company_id <> $2::uuid
    `,
    [clientUser.id, primaryCompany.id],
  );
  assert.equal(
    unrelatedPrimaryMembership.rowCount,
    0,
    "The local UAT client must not be reassigned from an unrelated primary company.",
  );
  await client.query(
    `
      DELETE FROM public.client_memberships
      WHERE user_id = $1::uuid
        AND client_company_id = $2::uuid
    `,
    [clientUser.id, foreignCompany.id],
  );
  await client.query(
    `
      INSERT INTO public.client_memberships (
        client_company_id, user_id, title, is_primary, created_by
      ) VALUES ($1::uuid, $2::uuid, 'Đại diện UAT', true, $3::uuid)
      ON CONFLICT (client_company_id, user_id) DO UPDATE
      SET title = EXCLUDED.title,
          is_primary = EXCLUDED.is_primary
    `,
    [primaryCompany.id, clientUser.id, admin.id],
  );

  const projectRows = [
    {
      ...managedProject,
      companyId: primaryCompany.id,
      managerUserId: leader.id,
      description: "Synthetic project managed by the local UAT leader.",
    },
    {
      ...foreignProject,
      companyId: foreignCompany.id,
      managerUserId: accountant.id,
      description: "Synthetic project intentionally outside leader scope.",
    },
  ];
  for (const project of projectRows) {
    const result = await client.query(
      `
        INSERT INTO public.projects (
          id, project_code, client_company_id, name, description, status, priority,
          project_manager_user_id, start_date, due_date, created_by, updated_by
        ) VALUES (
          $1::uuid, $2, $3::uuid, $4, $5,
          'active'::public.project_status, 'medium'::public.project_priority,
          $6::uuid, '2026-01-01', '2026-12-31', $7::uuid, $7::uuid
        )
        ON CONFLICT (id) DO UPDATE
        SET client_company_id = EXCLUDED.client_company_id,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            priority = EXCLUDED.priority,
            project_manager_user_id = EXCLUDED.project_manager_user_id,
            start_date = EXCLUDED.start_date,
            due_date = EXCLUDED.due_date,
            updated_by = EXCLUDED.updated_by
        RETURNING id
      `,
      [
        project.id,
        project.code,
        project.companyId,
        project.name,
        project.description,
        project.managerUserId,
        admin.id,
      ],
    );
    assert.equal(result.rowCount, 1);
  }

  await client.query(
    `
      DELETE FROM public.project_memberships
      WHERE project_id = $1::uuid
        AND user_id = ANY($2::uuid[])
    `,
    [foreignProject.id, [leader.id, employee.id]],
  );

  const membershipRows = [
    [managedProject.id, leader.id, "project_manager"],
    [managedProject.id, admin.id, "project_manager"],
    [managedProject.id, employee.id, "member"],
    [foreignProject.id, accountant.id, "project_manager"],
    [foreignProject.id, admin.id, "member"],
  ];
  for (const [projectId, userId, projectRole] of membershipRows) {
    await client.query(
      `
        INSERT INTO public.project_memberships (
          project_id, user_id, project_role, created_by
        ) VALUES ($1::uuid, $2::uuid, $3::public.project_member_role, $4::uuid)
        ON CONFLICT (project_id, user_id) DO UPDATE
        SET project_role = EXCLUDED.project_role
      `,
      [projectId, userId, projectRole, admin.id],
    );
  }

  await client.query(
    `DELETE FROM public.project_services WHERE project_id = $1::uuid`,
    [managedProject.id],
  );
  const service = await client.query(
    `
      SELECT id
      FROM public.services
      WHERE service_code = $1
        AND active = true
      ORDER BY id ASC
    `,
    [LOCAL_UAT.projectService.serviceCode],
  );
  assert.equal(
    service.rowCount,
    1,
    `Expected one active ${LOCAL_UAT.projectService.serviceCode} service fixture.`,
  );
  const projectService = await client.query(
    `
      INSERT INTO public.project_services (
        id, project_id, service_id, status, notes, created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'active'::public.project_service_status,
        'Synthetic local UAT project service only.', $4::uuid, $4::uuid
      )
      RETURNING id
    `,
    [
      LOCAL_UAT.projectService.id,
      managedProject.id,
      service.rows[0].id,
      admin.id,
    ],
  );
  assert.equal(projectService.rowCount, 1);
}

async function clearRunScopedFixtures() {
  const today = todayInTimezone("Asia/Ho_Chi_Minh");
  const { managed: managedProject, foreign: foreignProject } =
    LOCAL_UAT.projects;
  const { primary: primaryCompany, foreign: foreignCompany } =
    LOCAL_UAT.companies;

  await client.query(
    `
      DELETE FROM public.attendance_records
      WHERE user_id = ANY($1::uuid[])
        AND attendance_date = $2::date
    `,
    [UAT_USER_IDS, today],
  );
  await client.query(
    `
      DELETE FROM public.project_expenses
      WHERE project_id = ANY($1::uuid[])
        AND title LIKE $2
    `,
    [[managedProject.id, foreignProject.id], `${LOCAL_UAT.titlePrefix}%`],
  );
  await client.query(
    `
      DELETE FROM public.support_tickets
      WHERE client_company_id = ANY($1::uuid[])
        AND title LIKE $2
    `,
    [[primaryCompany.id, foreignCompany.id], `${LOCAL_UAT.titlePrefix}%`],
  );
  await client.query(
    `
      DELETE FROM public.payroll_runs
      WHERE period_month = ANY($1::text[])
         OR title LIKE '%UAT%'
         OR title LIKE '%Bảng lương%'
         OR title LIKE '%Payroll%'
         OR title LIKE '%Test%'
    `,
    [["2026-08", "2026-09", "2099-12", "1999-01", LOCAL_UAT.payroll.periodMonth]],
  );
  await client.query(
    `
      DELETE FROM public.company_documents
      WHERE title = $1
        AND uploaded_by_user_id = $2::uuid
    `,
    [LOCAL_UAT.documents.title, LOCAL_UAT.users.admin.id],
  );
}

async function seedCompensationFixture() {
  const table = await client.query(
    `SELECT to_regclass('public.employee_compensation_settings') AS relation`,
  );
  assert.ok(
    table.rows[0]?.relation,
    "Employee compensation migration must be applied before local UAT seeding.",
  );

  for (const [key, user] of Object.entries(LOCAL_UAT.users)) {
    if (!UAT_EMPLOYEE_USERS.some((employee) => employee.id === user.id)) {
      continue;
    }
    const compensation = LOCAL_UAT.compensation[key];
    const result = await client.query(
      `
        INSERT INTO public.employee_compensation_settings (
          user_id, base_salary, allowances, updated_by_user_id
        ) VALUES ($1::uuid, $2::numeric, $3::numeric, $4::uuid)
        ON CONFLICT (user_id) DO UPDATE
        SET base_salary = EXCLUDED.base_salary,
            allowances = EXCLUDED.allowances,
            updated_by_user_id = EXCLUDED.updated_by_user_id,
            updated_at = now()
        RETURNING user_id
      `,
      [
        user.id,
        compensation.baseSalary,
        compensation.allowances,
        LOCAL_UAT.users.admin.id,
      ],
    );
    assert.equal(result.rowCount, 1);
  }
}

async function seedAttendanceScopeFixture() {
  const { employee, foreignEmployee, admin } = LOCAL_UAT.users;
  const { managedRecordId, foreignRecordId } = LOCAL_UAT.attendance;

  const records = [
    {
      id: managedRecordId,
      userId: employee.id,
      checkIn: "2000-01-15T01:00:00.000Z",
      checkOut: "2000-01-15T10:30:00.000Z",
    },
    {
      id: foreignRecordId,
      userId: foreignEmployee.id,
      checkIn: "2000-01-15T01:05:00.000Z",
      checkOut: "2000-01-15T10:35:00.000Z",
    },
  ];
  for (const record of records) {
    const result = await client.query(
      `
        INSERT INTO public.attendance_records (
          id, user_id, attendance_date, check_in_at, check_out_at,
          check_in_latitude, check_in_longitude,
          check_out_latitude, check_out_longitude,
          status, late_minutes, early_leave_minutes, work_minutes,
          source, created_by, updated_by
        ) VALUES (
          $1::uuid, $2::uuid, $3::date, $4::timestamptz, $5::timestamptz,
          $6::numeric, $7::numeric, $6::numeric, $7::numeric,
          'present'::public.attendance_status, 0, 0, 570,
          'admin_adjustment'::public.attendance_source, $8::uuid, $8::uuid
        )
        ON CONFLICT (user_id, attendance_date) DO UPDATE
        SET check_in_at = EXCLUDED.check_in_at,
            check_out_at = EXCLUDED.check_out_at,
            check_in_latitude = EXCLUDED.check_in_latitude,
            check_in_longitude = EXCLUDED.check_in_longitude,
            check_out_latitude = EXCLUDED.check_out_latitude,
            check_out_longitude = EXCLUDED.check_out_longitude,
            status = EXCLUDED.status,
            late_minutes = EXCLUDED.late_minutes,
            early_leave_minutes = EXCLUDED.early_leave_minutes,
            work_minutes = EXCLUDED.work_minutes,
            source = EXCLUDED.source,
            updated_by = EXCLUDED.updated_by
        RETURNING id
      `,
      [
        record.id,
        record.userId,
        LOCAL_UAT.attendance.scopeDate,
        record.checkIn,
        record.checkOut,
        LOCAL_UAT.office.latitude,
        LOCAL_UAT.office.longitude,
        admin.id,
      ],
    );
    assert.equal(result.rowCount, 1);
  }
}

async function assertFixturePostconditions() {
  const { primary: primaryCompany, foreign: foreignCompany } =
    LOCAL_UAT.companies;
  const { managed: managedProject, foreign: foreignProject } =
    LOCAL_UAT.projects;
  const companies = await client.query(
    `
      SELECT id, name
      FROM public.client_companies
      WHERE id = ANY($1::uuid[])
      ORDER BY id ASC
    `,
    [[primaryCompany.id, foreignCompany.id]],
  );
  assert.equal(
    companies.rowCount,
    2,
    "Both scoped client companies must exist.",
  );

  const projects = await client.query(
    `
      SELECT id, client_company_id
      FROM public.projects
      WHERE id = ANY($1::uuid[])
      ORDER BY id ASC
    `,
    [[managedProject.id, foreignProject.id]],
  );
  assert.equal(projects.rowCount, 2, "Both scoped projects must exist.");

  const compensation = await client.query(
    `
      SELECT user_id
      FROM public.employee_compensation_settings
      WHERE user_id = ANY($1::uuid[])
    `,
    [UAT_EMPLOYEE_USERS.map((user) => user.id)],
  );
  assert.equal(
    compensation.rowCount,
    UAT_EMPLOYEE_USERS.length,
    "Every active local UAT employee must have persisted compensation.",
  );
}

async function seed() {
  await client.connect();
  try {
    await client.query("BEGIN");
    await seedAuthUsers();
    await ensureAdminAccount();
    await ensureApprovedAccounts();
    await normalizeProfileDetails();
    await normalizeAuthLoginFields();
    await configureCanonicalSettings();
    await upsertOrganizationFixture();
    await clearRunScopedFixtures();
    await seedCompensationFixture();
    await seedAttendanceScopeFixture();
    await assertFixturePostconditions();
    await client.query("COMMIT");

    console.log(
      "Local synthetic UAT fixture is ready: five role logins, managed/foreign scope, canonical attendance, and persisted compensation.",
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Local UAT seed failed: ${message}`);
  process.exitCode = 1;
});
