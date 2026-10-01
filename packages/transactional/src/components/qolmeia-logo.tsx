import { Img } from "react-email";

type QolmeiaLogoProps = {
  height?: number;
  width?: number;
};

const QolmeiaLogo = ({ height = 36, width = 126 }: QolmeiaLogoProps) => {
  return (
    <Img
      alt="Qolmeia"
      height={height}
      src="https://www.qolmeia.com/logo-wordmark.png"
      width={width}
    />
  );
};

export { QolmeiaLogo };
