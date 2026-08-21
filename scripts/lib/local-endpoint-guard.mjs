const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const LOCAL_SUPABASE_DATABASE_PORT = "54322";
const LOCAL_SUPABASE_DATABASE_NAME = "postgres";
const LOCAL_SUPABASE_MIGRATION_ROLE = "supabase_admin";
const DISPOSABLE_DATABASE_CONFIRMATION_ENV = "PGS_RELEASE_DB_DISPOSABLE";
const DISPOSABLE_DATABASE_CONFIRMATION_VALUE = "confirmed";
const CONNECTION_TARGET_QUERY_PARAMETERS = new Set([
  "host",
  "hostname",
  "hostaddr",
  "port",
  "database",
  "dbname",
]);
const HOSTED_SUPABASE_ENVIRONMENT_MARKER =
  /umtgfaqjoqbsdzwpqizq|supabase\.co/iu;

/**
 * Fail closed when the inherited environment contains a known hosted
 * Supabase marker. Local release scripts intentionally inspect the complete
 * environment rather than only the connection variables, because a process
 * can otherwise accidentally pick up a hosted URL or project reference
 * through a library, shell profile, or child-process configuration.
 *
 * Do not include matched names or values in the error: environment entries
 * can contain credentials and this guard must never turn a refusal into a
 * secret disclosure.
 */
export function assertNoHostedSupabaseEnvironment(environment = process.env) {
  for (const [name, value] of Object.entries(environment)) {
    if (
      HOSTED_SUPABASE_ENVIRONMENT_MARKER.test(name) ||
      (typeof value === "string" &&
        HOSTED_SUPABASE_ENVIRONMENT_MARKER.test(value))
    ) {
      throw new Error(
        "Refusing local-only operation because the process environment contains a hosted Supabase marker.",
      );
    }
  }
}

function parseUrl(value, label) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} must be a valid absolute URL.`);
  }
}

export function assertLoopbackUrl(value, label, protocols) {
  const url = parseUrl(value, label);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (!protocols.includes(url.protocol) || !LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(
      `${label} must target a loopback host using one of: ${protocols.join(", ")}.`,
    );
  }

  return url;
}

export function assertDisposableLocalDatabaseUrl(
  value,
  label = "DATABASE_URL",
) {
  const url = assertLoopbackUrl(value, label, ["postgres:", "postgresql:"]);

  if (url.port !== LOCAL_SUPABASE_DATABASE_PORT) {
    throw new Error(
      `${label} must use the local Supabase PostgreSQL port ${LOCAL_SUPABASE_DATABASE_PORT}.`,
    );
  }

  if (url.pathname !== `/${LOCAL_SUPABASE_DATABASE_NAME}`) {
    throw new Error(
      `${label} must use the local Supabase database ${LOCAL_SUPABASE_DATABASE_NAME}.`,
    );
  }

  for (const key of url.searchParams.keys()) {
    if (CONNECTION_TARGET_QUERY_PARAMETERS.has(key.toLowerCase())) {
      throw new Error(
        `${label} must not override its local Supabase connection target through query parameters.`,
      );
    }
  }

  return url;
}

export function assertConfirmedDisposableLocalDatabaseUrl(
  value,
  label = "DATABASE_URL",
  environment = process.env,
) {
  const url = assertDisposableLocalDatabaseUrl(value, label);

  if (
    environment[DISPOSABLE_DATABASE_CONFIRMATION_ENV] !==
    DISPOSABLE_DATABASE_CONFIRMATION_VALUE
  ) {
    throw new Error(
      `Refusing destructive local database verification. Set ${DISPOSABLE_DATABASE_CONFIRMATION_ENV}=${DISPOSABLE_DATABASE_CONFIRMATION_VALUE} only after confirming this local Supabase database is disposable.`,
    );
  }

  return url;
}

/**
 * Modern local Supabase images intentionally keep the `postgres` login
 * non-superuser. Release migrations attach a trigger to auth.users and
 * register Storage buckets, so the verifier needs the image's local-only
 * migration role. Keeping this check next to the loopback/disposable check
 * turns an otherwise late, ambiguous ACL failure into a fail-closed preflight.
 */
export function assertConfirmedLocalSupabaseMigrationDatabaseUrl(
  value,
  label = "DATABASE_URL",
  environment = process.env,
) {
  const url = assertConfirmedDisposableLocalDatabaseUrl(
    value,
    label,
    environment,
  );
  const username = decodeURIComponent(url.username);

  if (username !== LOCAL_SUPABASE_MIGRATION_ROLE) {
    throw new Error(
      `${label} must use the local Supabase migration role ${LOCAL_SUPABASE_MIGRATION_ROLE}; the local postgres role cannot manage the auth and storage schemas required by this verifier.`,
    );
  }

  return url;
}

export {
  DISPOSABLE_DATABASE_CONFIRMATION_ENV,
  DISPOSABLE_DATABASE_CONFIRMATION_VALUE,
  LOCAL_SUPABASE_DATABASE_NAME,
  LOCAL_SUPABASE_DATABASE_PORT,
  LOCAL_SUPABASE_MIGRATION_ROLE,
};
