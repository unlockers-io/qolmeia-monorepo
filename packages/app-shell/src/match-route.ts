const matchesRoute = (pathname: string, route: string): boolean =>
  route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`);

export { matchesRoute };
