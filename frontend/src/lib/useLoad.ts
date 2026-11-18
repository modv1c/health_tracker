import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";

/** Загружает данные при открытии страницы и умеет перезагружать их после изменений. */
export function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    try {
      const result = await loaderRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "Неизвестная ошибка"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { data, error, loading, reload, setData };
}

/** Достаёт текст ошибки из чего угодно. */
export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Что-то пошло не так";
}

/**
 * Общая логика удаления записи: флаг "удаляю…", вызов API, уведомление, перезагрузка списка.
 * Используется на страницах тренировок, питания и сна.
 */
export function useDeleteRecord<T extends { id: number }>(
  remove: (id: number) => Promise<void>,
  reload: () => Promise<void>,
  notify: (text: string, kind?: "success" | "error") => void,
) {
  const [target, setTarget] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await remove(target.id);
      notify("Запись удалена");
      setTarget(null);
      await reload();
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return { target, setTarget, busy, confirm, cancel: () => setTarget(null) };
}
