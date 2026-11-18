import type { ActivityLevel, Gender, Goal, User } from "../api/types";

/** Те же поля, что проверяет ensure_profile_complete на бэкенде. */
export function isProfileComplete(user: User | null): boolean {
  if (!user) return false;
  return [user.weight, user.height, user.gender, user.birth_date, user.activity_level, user.current_goal]
    .every((v) => v !== null && v !== undefined);
}

export const GOAL_LABEL: Record<Goal, string> = {
  bulking: "Набор массы",
  maintenance: "Поддержание",
  cutting: "Похудение",
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Сидячий образ жизни",
  light: "Лёгкая (1–3 тренировки в неделю)",
  moderate: "Умеренная (3–5 тренировок)",
  active: "Высокая (6–7 тренировок)",
  very_active: "Очень высокая (физ. работа + спорт)",
};

export const GENDER_LABEL: Record<Gender, string> = { male: "Мужской", female: "Женский" };

const dayFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const shortDayFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const fullFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });

/** Бэкенд отдаёт `date` без часового пояса (время сервера = локальное время ноутбука). */
export function parseDate(value: string): Date {
  return new Date(value);
}

export const formatDay = (value: string | Date) => dayFmt.format(typeof value === "string" ? parseDate(value) : value);
export const formatShortDay = (value: string) => shortDayFmt.format(new Date(`${value}T00:00:00`));
export const formatTime = (value: string) => timeFmt.format(parseDate(value));
export const formatToday = () => {
  const text = fullFmt.format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function dayKey(value: string | Date): string {
  const d = typeof value === "string" ? parseDate(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function relativeDayLabel(value: string): string {
  const key = dayKey(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === dayKey(today)) return "Сегодня";
  if (key === dayKey(yesterday)) return "Вчера";
  return formatDay(value);
}

export function isToday(value: string): boolean {
  return dayKey(value) === dayKey(new Date());
}

/** "2026-11-17T23:00" (поле datetime-local) -> ISO-строка в UTC с часовым поясом. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

/** ISO-строка -> значение для <input type="datetime-local"> в местном времени. */
export function isoToLocalInput(value: string): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function durationLabel(fromIso: string, toIso: string): string {
  const minutes = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function ageFrom(birthDate: string): number {
  const b = new Date(`${birthDate}T00:00:00`);
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--;
  return age;
}

export const nf = new Intl.NumberFormat("ru-RU");

/** 62.5 -> "62,5 кг", null -> "свой вес" */
export const formatWeight = (kg: number | null) => (kg === null ? "свой вес" : `${nf.format(kg)} кг`);

/** Группирует записи по дню (записи уже отсортированы сервером от новых к старым). */
export function groupByDay<T>(items: T[], getDate: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKey(getDate(item));
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return [...map.entries()];
}
