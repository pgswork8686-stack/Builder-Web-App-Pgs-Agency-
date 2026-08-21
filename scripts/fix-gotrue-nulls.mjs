import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres" });

async function fix() {
  await client.connect();
  console.log("Updating confirmation_token in auth.users to non-null empty strings for GoTrue compatibility...");
  await client.query(`
    UPDATE auth.users
    SET
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      phone_change = COALESCE(phone_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      reauthentication_token = COALESCE(reauthentication_token, '');
  `);
  console.log("Updated auth.users fields.");
  await client.end();
}

fix().catch(console.error);
