export interface CapturedRequest {
  id: string;
  token: string;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body: string | null;
  contentType: string | null;
  capturedAt: string;
  sizeBytes: number;
}

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}
