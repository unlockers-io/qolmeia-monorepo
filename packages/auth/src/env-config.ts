const LOCALHOST_ALLOWED_HOSTS = ["**.localhost", "**.localhost:*", "localhost:*", "127.0.0.1:*"];

const LOOPBACK_TRUSTED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

type AuthEnv = {
  TRUSTED_ORIGINS?: string;
  WEB_APP_URL?: string;
};

type EnvAuthConfig = {
  allowedHosts: Array<string>;
  trustedOrigins: Array<string>;
  useSecureCookies: boolean;
};

const parseEnvList = (value: string | undefined): Array<string> => {
  if (value === undefined || value === "") {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const envAuthConfig = (env: AuthEnv): EnvAuthConfig => ({
  allowedHosts: LOCALHOST_ALLOWED_HOSTS,
  trustedOrigins: [...LOOPBACK_TRUSTED_ORIGINS, ...parseEnvList(env.TRUSTED_ORIGINS)],
  useSecureCookies: env.WEB_APP_URL?.startsWith("https://") === true,
});

export { envAuthConfig, parseEnvList };
export type { AuthEnv, EnvAuthConfig };
