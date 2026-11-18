
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";

export type Slot =
  | "MORNING"
  | "AFTER_BREAKFAST"
  | "AFTER_LUNCH"
  | "AFTER_DINNER";

export type User = {
  id: number;
  name: string;
  email: string;
};

export type Reading = {
  id: number;
  userId: number;
  date: string;
  slot: Slot;
  value: number;
  createdAt: string;
  updatedAt: string;
};

export type Report = {
  report: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  highest: number | null;
  lowest: number | null;
  average: number | null;
  count: number;
  readings?: Reading[];
};

export const SLOT_LABELS: Record<Slot, string> = {
  MORNING: "Morning (fasting)",
  AFTER_BREAKFAST: "After breakfast",
  AFTER_LUNCH: "After lunch",
  AFTER_DINNER: "After dinner",
};

export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
    "Content-Type": "application/json",
    "X-Timezone-Offset": String(new Date().getTimezoneOffset()),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data as T;
}
