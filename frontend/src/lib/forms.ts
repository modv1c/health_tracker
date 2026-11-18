import { useState } from "react";
import { ApiError } from "../api/client";

export type FieldErrors = Record<string, string>;

/** Проверка целого числа в диапазоне — повторяет Field(ge=..., le=...) из схем бэкенда. */
export function intInRange(raw: string, min: number, max: number, label = "Значение"): string | null {
  if (raw.trim() === "") return "Обязательное поле";
  if (!/^-?\d+$/.test(raw.trim())) return "Нужно целое число";
  const n = Number(raw);
  if (n < min) return `${label}: минимум ${min}`;
  if (n > max) return `${label}: максимум ${max}`;
  return null;
}

/** Вес в кг: пусто = собственный вес (null), запятая или точка, до 2 знаков после запятой. */
export function parseWeight(raw: string): { value: number | null; error: string | null } {
  const text = raw.trim().replace(",", ".");
  if (text === "") return { value: null, error: null };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { value: null, error: "Число, например 62,5" };
  const value = Number(text);
  if (value > 500) return { value: null, error: "Максимум 500 кг" };
  return { value, error: null };
}

export function textLength(raw: string, max = 100): string | null {
  if (!raw.trim()) return "Обязательное поле";
  if (raw.trim().length > max) return `Максимум ${max} символов`;
  return null;
}

/** Состояние формы: значения, ошибки по полям, общая ошибка и флаг отправки. */
export function useForm<T extends Record<string, string | boolean>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  /** Запускает проверку и отправку; ошибки сервера раскладывает по полям. */
  async function submit(validate: (v: T) => FieldErrors, send: () => Promise<void>) {
    const found = validate(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return false;
    setBusy(true);
    try {
      await send();
      return true;
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else setFormError(err instanceof Error ? err.message : "Что-то пошло не так");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { values, set, errors, formError, busy, submit };
}

export function collect(entries: [string, string | null][]): FieldErrors {
  return Object.fromEntries(entries.filter(([, e]) => e !== null)) as FieldErrors;
}
