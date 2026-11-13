const FALLBACK_PATH = "/";

const ANCHOR_ORIGIN = "https://anchor.invalid";

const FROM_PARAM = "from";

const safeRedirectPath = (value: string | null | undefined): string => {
  if (
    value === null ||
    value === undefined ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return FALLBACK_PATH;
  }

  try {
    if (new URL(value, ANCHOR_ORIGIN).origin !== ANCHOR_ORIGIN) {
      return FALLBACK_PATH;
    }
  } catch {
    return FALLBACK_PATH;
  }

  return value;
};

const withFrom = (path: string, from: string | null | undefined): string => {
  const target = safeRedirectPath(from);

  return target === FALLBACK_PATH
    ? path
    : `${path}?${new URLSearchParams({ [FROM_PARAM]: target }).toString()}`;
};

const loginHref = (from: string | null | undefined): string => withFrom("/login", from);

const redirectFrom = (search: string): string =>
  safeRedirectPath(new URLSearchParams(search).get(FROM_PARAM));

export { FROM_PARAM, loginHref, redirectFrom, safeRedirectPath, withFrom };
