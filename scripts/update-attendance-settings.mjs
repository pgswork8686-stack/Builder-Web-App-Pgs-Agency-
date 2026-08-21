import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres" });

async function run() {
  await client.connect();
  console.log("Updating single attendance_settings row...");
  await client.query(`
    UPDATE public.attendance_settings
    SET
      timezone = 'Asia/Ho_Chi_Minh',
      workday_start_time = '08:00:00',
      workday_end_time = '17:30:00',
      late_grace_minutes = 5,
      early_leave_grace_minutes = 5,
      office_latitude = 20.9768,
      office_longitude = 105.7725,
      location_radius_meters = 100;
  `);

  const res = await client.query("SELECT * FROM public.attendance_settings LIMIT 1;");
  console.log("Active Attendance Settings:", res.rows[0]);
  await client.end();
}

run().catch(console.error);
