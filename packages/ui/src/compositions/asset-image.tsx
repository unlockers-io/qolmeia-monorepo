import Image, { type ImageProps } from "next/image";

type AssetImageProps = Omit<ImageProps, "loader" | "unoptimized">;

// Private assets are session-authorized same-origin paths or browser-local blob URLs.
// Fetch them in the browser, where the session cookie applies, not through the
// optimizer, which fetches without it and caches beyond authorization.
const AssetImage = (props: AssetImageProps) => <Image {...props} unoptimized />;

export { AssetImage };
