export interface ApiMeta {
  generatedAt: string;
  source: "mock" | "service" | "database";
  version: string;
}

export interface ApiSuccess<T> {
  data: T;
  meta: ApiMeta;
}

export function apiSuccess<T>(data: T, source: ApiMeta["source"] = "mock"): ApiSuccess<T> {
  return {
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      source,
      version: "0.3.0"
    }
  };
}
