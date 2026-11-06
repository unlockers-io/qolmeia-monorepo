const MAIN_CONTENT_ID = "main-content";

const SkipLink = () => (
  <a
    className="sr-only fixed top-2 left-2 z-50 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground ring-1 ring-ring focus:not-sr-only"
    href={`#${MAIN_CONTENT_ID}`}
  >
    Pular para o conteúdo
  </a>
);

export { MAIN_CONTENT_ID, SkipLink };
