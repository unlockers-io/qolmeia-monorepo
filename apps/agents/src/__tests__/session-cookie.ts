const sessionInit = (token: string, init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `qolmeia.session_token=${token}`);
  return { ...init, headers };
};

export { sessionInit };
