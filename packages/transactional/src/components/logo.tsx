import { displayName, origins } from "@repo/identity";
import { Img } from "react-email";

type LogoProps = {
  height?: number;
  width?: number;
};

const Logo = ({ height = 36, width = 126 }: LogoProps) => {
  return (
    <Img
      alt={displayName}
      height={height}
      src={`${origins.landing}/logo-wordmark.png`}
      width={width}
    />
  );
};

export { Logo };
