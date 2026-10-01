export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
export function paragraphHtml(paragraph: string): string {
  return paragraph
    .split(/(https:\/\/[^\s]+|\{\{portal_access_url\}\})/g)
    .map((part, index) => {
      if (index % 2 === 0) return escapeHtml(part);
      const url = part.replace(/[.,;:!?]+$/, "");
      return `<a href="${escapeHtml(url)}" style="color:#17372d;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">${escapeHtml(url)}</a>${escapeHtml(part.slice(url.length))}`;
    })
    .join("");
}
