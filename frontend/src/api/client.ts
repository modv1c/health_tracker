import type {
  DailyStat, ExerciseProgress, Meal, MealInput, ProfileUpdate, Recommendation, SleepInput, SleepRecord,
  Summary, Targets, User, Workout, WorkoutInput,
} from "./types";

// Запросы идут на /api того же адреса, а Vite (vite.config.ts) пересылает их на бэкенд
const API_URL = "/api";
const TOKEN_KEY = "ht_token";

/** Ошибка от API: статус + текст для человека + ошибки по конкретным полям формы. */
export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (token: string) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* приватный режим */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* приватный режим */ }
  },
};

// Сообщения Pydantic по-английски — переводим самые частые
function translate(msg: string): string {
  const cleaned = msg.replace(/^Value error, /, "");
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/greater than or equal to (\S+)/, (m) => `Минимум ${m[1]}`],
    [/less than or equal to (\S+)/, (m) => `Максимум ${m[1]}`],
    [/at least (\d+) characters?/, (m) => `Минимум ${m[1]} символов`],
    [/at most (\d+) characters?/, (m) => `Максимум ${m[1]} символов`],
    [/valid email/, () => "Некорректный email"],
    [/Field required/, () => "Обязательное поле"],
    [/valid integer/, () => "Нужно целое число"],
    [/should match pattern/, () => "Только латиница, цифры и _ . -"],
    [/timezone/, () => "Нужна дата с часовым поясом"],
    [/Extra inputs/, () => "Лишнее поле"],
  ];
  for (const [re, fn] of rules) {
    const m = cleaned.match(re);
    if (m) return fn(m);
  }
  return cleaned;
}

interface PydanticError { loc: (string | number)[]; msg: string }

async function parseError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try { body = await response.json(); } catch { /* тело не JSON */ }
  const detail = (body as { detail?: unknown } | null)?.detail;

  // 422 от FastAPI: detail = [{loc: ["body", "reps"], msg: "..."}]
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {};
    const general: string[] = [];
    for (const err of detail as PydanticError[]) {
      const field = err.loc?.[err.loc.length - 1];
      const text = translate(err.msg);
      if (typeof field === "string" && field !== "body") fields[field] = text;
      else general.push(text);
    }
    const message = general[0] ?? Object.values(fields)[0] ?? "Проверьте введённые данные";
    return new ApiError(response.status, message, fields);
  }
  if (typeof detail === "string") return new ApiError(response.status, detail);
  // Ответ не от FastAPI (нет JSON) — значит прокси Vite не достучался до бэкенда
  if (response.status >= 500 && body === null) {
    return new ApiError(response.status, "Бэкенд не отвечает. Проверьте, что uvicorn запущен");
  }
  return new ApiError(response.status, `Ошибка сервера (${response.status})`);
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof URLSearchParams)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "Сервер недоступен. Проверьте, что бэкенд запущен (uvicorn)");
  }

  if (response.status === 401 && token) {
    tokenStore.clear();
    onUnauthorized();
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const json = (data: unknown) => JSON.stringify(data);

export const api = {
  register: (data: { username: string; email: string; password: string }) =>
    request<User>("/auth/register", { method: "POST", body: json(data) }),

  // /auth/login принимает форму (OAuth2PasswordRequestForm), а не JSON
  login: (username: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: new URLSearchParams({ username, password }),
    }),

  me: () => request<User>("/auth/me"),
  updateMe: (data: ProfileUpdate) => request<User>("/auth/me", { method: "PATCH", body: json(data) }),
  deleteMe: () => request<void>("/auth/me", { method: "DELETE" }),
  targets: () => request<Targets>("/auth/me/targets"),

  workouts: () => request<Workout[]>("/workouts/"),
  createWorkout: (data: WorkoutInput) => request<Workout>("/workouts/", { method: "POST", body: json(data) }),
  updateWorkout: (id: number, data: Partial<WorkoutInput>) =>
    request<Workout>(`/workouts/${id}`, { method: "PATCH", body: json(data) }),
  deleteWorkout: (id: number) => request<void>(`/workouts/${id}`, { method: "DELETE" }),
  progress: () => request<ExerciseProgress[]>("/workouts/progress"),

  meals: () => request<Meal[]>("/nutrition/"),
  createMeal: (data: MealInput) => request<Meal>("/nutrition/", { method: "POST", body: json(data) }),
  updateMeal: (id: number, data: Partial<MealInput>) =>
    request<Meal>(`/nutrition/${id}`, { method: "PATCH", body: json(data) }),
  deleteMeal: (id: number) => request<void>(`/nutrition/${id}`, { method: "DELETE" }),

  sleep: () => request<SleepRecord[]>("/sleep/"),
  createSleep: (data: SleepInput) => request<SleepRecord>("/sleep/", { method: "POST", body: json(data) }),
  updateSleep: (id: number, data: Partial<SleepInput>) =>
    request<SleepRecord>(`/sleep/${id}`, { method: "PATCH", body: json(data) }),
  deleteSleep: (id: number) => request<void>(`/sleep/${id}`, { method: "DELETE" }),

  summary: () => request<Summary>("/stats/summary"),
  daily: (days = 7) => request<DailyStat[]>(`/stats/daily?days=${days}`),
  recommendations: () => request<Recommendation[]>("/recommendations/"),
};
