import { Img } from "@react-email/components";

export type FssEmailImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export function EmailImage({ src, alt, width, height }: FssEmailImageProps) {
  const trimmedAlt = alt.trim();
  if (!trimmedAlt) {
    throw new TypeError("Email images require non-empty alt text.");
  }
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new TypeError("Email images require positive integer dimensions.");
  }

  return (
    <Img
      src={src}
      alt={trimmedAlt}
      width={width}
      height={height}
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
    />
  );
}
