const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const LOCAL_SUPABASE_DATABASE_PORT = "54322";
const LOCAL_SUPABASE_DATABASE_NAME = "postgres";
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

export {
  DISPOSABLE_DATABASE_CONFIRMATION_ENV,
  DISPOSABLE_DATABASE_CONFIRMATION_VALUE,
  LOCAL_SUPABASE_DATABASE_NAME,
  LOCAL_SUPABASE_DATABASE_PORT,
};
