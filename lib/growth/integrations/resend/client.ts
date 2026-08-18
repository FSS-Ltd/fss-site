import { Resend } from "resend";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 3;

const ALLOWED_CATEGORIES: readonly ResendMessage["category"][] = [
  "site-enquiry",
  "resource-delivery",
  "client-delivery-thank-you",
  "newsletter-welcome",
  "newsletter",
];

export type ResendMessage = {
  idempotencyKey: string;
  category:
    | "site-enquiry"
    | "resource-delivery"
    | "client-delivery-thank-you"
    | "newsletter-welcome"
    | "newsletter";
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export interface ResendGateway {
  send(message: ResendMessage): Promise<{ providerMessageId: string }>;
}

export type ResendClientErrorCode =
  | "REJECTED_CATEGORY"
  | "RETRYABLE_PROVIDER_ERROR"
  | "PERMANENT_PROVIDER_ERROR"
  | "INVALID_PROVIDER_RESPONSE";

export class ResendClientError extends Error {
  public readonly retryable: boolean;

  constructor(public readonly code: ResendClientErrorCode) {
    super("The Resend provider request failed.");
    this.name = "ResendClientError";
    this.retryable = code === "RETRYABLE_PROVIDER_ERROR";
  }
}

export type ResendProviderErrorEvent = {
  code: ResendClientErrorCode;
  category: ResendMessage["category"];
  idempotencyKey: string;
  attempt: number;
  retryable: boolean;
};

export type ResendClientDependencies = {
  baseUrl?: string;
  requestTimeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: (attempt: number) => number;
  sleep?: (ms: number) => Promise<void>;
  onProviderError?: (event: ResendProviderErrorEvent) => void;
};

function requireNonEmpty(value: string, field: string): string {
  if (!value.trim()) {
    throw new TypeError(`Resend message ${field} must not be blank.`);
  }
  return value;
}

function defaultRetryDelayMs(attempt: number): number {
  return 200 * 2 ** (attempt - 1);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultOnProviderError(event: ResendProviderErrorEvent): void {
  console.error("[ResendClient] provider request failed", event);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ResendClientError("RETRYABLE_PROVIDER_ERROR"));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function classifyProviderError(statusCode: number | null): ResendClientErrorCode {
  if (statusCode === null || statusCode === 429 || statusCode >= 500) {
    return "RETRYABLE_PROVIDER_ERROR";
  }
  return "PERMANENT_PROVIDER_ERROR";
}

class ResendSdkGateway implements ResendGateway {
  private readonly resend: Resend;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: (attempt: number) => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly onProviderError: (event: ResendProviderErrorEvent) => void;

  constructor(apiKey: string, dependencies: ResendClientDependencies) {
    this.resend = new Resend(apiKey, dependencies.baseUrl ? { baseUrl: dependencies.baseUrl } : undefined);
    this.timeoutMs = dependencies.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxAttempts = dependencies.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.retryDelayMs = dependencies.retryDelayMs ?? defaultRetryDelayMs;
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.onProviderError = dependencies.onProviderError ?? defaultOnProviderError;
  }

  async send(message: ResendMessage): Promise<{ providerMessageId: string }> {
    if (!ALLOWED_CATEGORIES.includes(message.category)) {
      throw new ResendClientError("REJECTED_CATEGORY");
    }
    requireNonEmpty(message.idempotencyKey, "idempotency key");
    requireNonEmpty(message.from, "from address");
    requireNonEmpty(message.to, "recipient");
    requireNonEmpty(message.replyTo, "reply-to address");
    requireNonEmpty(message.subject, "subject");
    requireNonEmpty(message.html, "HTML body");
    requireNonEmpty(message.text, "text body");

    let lastError = new ResendClientError("RETRYABLE_PROVIDER_ERROR");

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await this.attemptSend(message);
      } catch (error) {
        if (!(error instanceof ResendClientError)) {
          throw error;
        }
        this.onProviderError({
          code: error.code,
          category: message.category,
          idempotencyKey: message.idempotencyKey,
          attempt,
          retryable: error.retryable,
        });
        if (!error.retryable) {
          throw error;
        }
        lastError = error;
        if (attempt < this.maxAttempts) {
          await this.sleep(this.retryDelayMs(attempt));
        }
      }
    }

    throw lastError;
  }

  private async attemptSend(message: ResendMessage): Promise<{ providerMessageId: string }> {
    const response = await withTimeout(
      this.resend.emails.send(
        {
          from: message.from,
          to: message.to,
          replyTo: message.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
        },
        { idempotencyKey: message.idempotencyKey },
      ),
      this.timeoutMs,
    );

    if (response.error) {
      throw new ResendClientError(classifyProviderError(response.error.statusCode));
    }
    if (!response.data?.id) {
      throw new ResendClientError("INVALID_PROVIDER_RESPONSE");
    }
    return { providerMessageId: response.data.id };
  }
}

export function createResendClient(
  apiKey: string,
  dependencies: ResendClientDependencies = {},
): ResendGateway {
  return new ResendSdkGateway(apiKey, dependencies);
}
