import Image, { type ImageProps } from "next/image";

type AssetImageProps = Omit<ImageProps, "loader" | "unoptimized">;

// Private assets use expiring signatures or browser-local blob URLs. Fetch them in
// the browser, not through a public optimizer cache that can outlive authorization.
const AssetImage = (props: AssetImageProps) => <Image {...props} unoptimized />;

export { AssetImage };
