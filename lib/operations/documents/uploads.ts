export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_ATTACHMENTS = 5;
export type UploadConfiguration = { enabled: false; reason: string };
// No approved scanner adapter exists yet. Environment flags cannot bypass this gate.
export function documentUploadConfiguration(): UploadConfiguration {
  return {
    enabled: false,
    reason:
      "Uploads are unavailable until an approved malware scanner is configured.",
  };
}
