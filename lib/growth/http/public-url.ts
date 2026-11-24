export function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.hostname.includes(".") &&
      !url.hostname.endsWith(".localhost") &&
      !url.hostname.endsWith(".local") &&
      !url.hostname.includes(":") &&
      !/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}
