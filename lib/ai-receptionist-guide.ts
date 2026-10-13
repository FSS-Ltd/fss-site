export const AI_RECEPTIONIST_GUIDE_SLUG = "ai-receptionist-setup-guide";
export const AI_RECEPTIONIST_GUIDE_PATH = `/resources/${AI_RECEPTIONIST_GUIDE_SLUG}`;

export function isAiReceptionistGuidePath(pathname: string | null): boolean {
  return (
    pathname === AI_RECEPTIONIST_GUIDE_PATH ||
    pathname === `${AI_RECEPTIONIST_GUIDE_PATH}/thank-you`
  );
}
