type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export async function safeJson<T = unknown>(response: Response): Promise<T | UnknownRecord> {
  try {
    return (await response.json()) as T;
  } catch {
    return {};
  }
}

export function getApiErrorMessage(payload: unknown, fallback: string) {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }
  return fallback;
}

export function assertApiData<T>(
  payload: unknown,
  predicate?: (data: unknown) => boolean,
  fallback = "Request succeeded but returned no usable data."
) {
  if (!isRecord(payload) || !("data" in payload)) {
    throw new Error(fallback);
  }

  const data = payload.data;
  if (data == null) {
    throw new Error(fallback);
  }

  if (predicate && !predicate(data)) {
    throw new Error(fallback);
  }

  return data as T;
}
