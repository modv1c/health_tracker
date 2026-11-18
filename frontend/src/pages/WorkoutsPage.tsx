import { useMemo, useState } from "react";
import { Dumbbell, Pencil, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "../api/client";
import type { ExerciseProgress, Workout, WorkoutInput } from "../api/types";
import { ConfirmDialog, EmptyState, FormAlert, Modal, SkeletonRows, TextField } from "../components/ui";
import { useToast } from "../components/Toast";
import { collect, intInRange, parseWeight, textLength, useForm } from "../lib/forms";
import { formatTime, formatWeight, groupByDay, nf, plural, relativeDayLabel } from "../lib/format";
import { useDeleteRecord, useLoad } from "../lib/useLoad";

export function WorkoutsPage() {
  const workouts = useLoad(api.workouts);
  const progress = useLoad(api.progress);
  const { data, loading, error } = workouts;
  const [editing, setEditing] = useState<Workout | "new" | null>(null);
  const toast = useToast();

  // после любого изменения обновляем и список, и прогресс
  const reload = async () => { await Promise.all([workouts.reload(), progress.reload()]); };

  const groups = useMemo(() => groupByDay(data ?? [], (w) => w.date), [data]);
  const weekCount = (data ?? []).filter((w) => Date.now() - new Date(w.date).getTime() < 7 * 864e5).length;
  const totalMinutes = (data ?? []).reduce((acc, w) => acc + w.workout_time, 0);

  const del = useDeleteRecord<Workout>(api.deleteWorkout, reload, toast);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Тренировки</h1>
          <p>Упражнения, подходы и время отдыха</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={18} aria-hidden /> Добавить</button>
      </header>

      <div className="grid-page">
        <section className="card" aria-label="Список тренировок">
          {error && <FormAlert message={error.message} />}
          {loading ? <SkeletonRows count={4} /> : groups.length === 0 ? (
            <EmptyState
              icon={<Dumbbell size={26} />} title="Пока нет тренировок"
              text="Добавьте первое упражнение — оно появится здесь и в статистике"
              action={<button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>Добавить тренировку</button>}
            />
          ) : (
            <div className="list">
              {groups.map(([day, items]) => (
                <div key={day}>
                  <div className="list-group-title">
                    <span>{relativeDayLabel(items[0].date)}</span>
                    <span>{items.length} {plural(items.length, "упражнение", "упражнения", "упражнений")}</span>
                  </div>
                  {items.map((w) => (
                    <div className="row" key={w.id}>
                      <span className="row-mark" aria-hidden />
                      <div className="row-body">
                        <div className="row-title">{w.workout_name}</div>
                        <div className="row-meta">
                          <span><b style={{ color: "var(--text)" }}>{formatWeight(w.weight_kg)}</b></span>
                          <span>{w.sets} × {w.reps}</span>
                          <span>{w.workout_time} мин</span>
                          <span>отдых {w.time_between_sets} с</span>
                          <span>{formatTime(w.date)}</span>
                        </div>
                      </div>
                      {w.to_failure && <span className="chip warn">до отказа</span>}
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => setEditing(w)} aria-label={`Изменить «${w.workout_name}»`}><Pencil size={18} /></button>
                        <button className="icon-btn danger" onClick={() => del.setTarget(w)} aria-label={`Удалить «${w.workout_name}»`}><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <aside className="card" aria-label="Прогресс по весу">
            <div className="card-title">Прогресс</div>
            <div className="card-sub" style={{ marginBottom: 8 }}>Первый → последний рабочий вес</div>
            {progress.loading ? <SkeletonRows count={2} /> : !progress.data?.length ? (
              <p className="card-sub">Укажите вес в упражнениях — здесь появится прогресс по каждому из них.</p>
            ) : (
              <div className="list">
                {progress.data.map((p) => <ProgressRow key={p.exercise} item={p} />)}
              </div>
            )}
          </aside>

          <aside className="card" aria-label="Итоги">
            <div className="card-title" style={{ marginBottom: 12 }}>Итоги</div>
            <div className="kpi" style={{ marginBottom: 16 }}>
              <div className="kpi-icon"><Dumbbell size={22} aria-hidden /></div>
              <div><div className="kpi-label">За 7 дней</div><div className="kpi-value">{weekCount}</div></div>
            </div>
            <div className="kpi">
              <div className="kpi-icon sand"><Dumbbell size={22} aria-hidden /></div>
              <div><div className="kpi-label">Всего минут</div><div className="kpi-value">{nf.format(totalMinutes)}</div></div>
            </div>
          </aside>
        </div>
      </div>

      {editing && (
        <WorkoutForm
          workout={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => { setEditing(null); toast(msg); await reload(); }}
        />
      )}
      {del.target && (
        <ConfirmDialog
          title="Удалить тренировку?"
          text={<>«{del.target.workout_name}» будет удалена без возможности восстановления.</>}
          busy={del.busy} onConfirm={del.confirm} onClose={del.cancel}
        />
      )}
    </>
  );
}

function ProgressRow({ item }: { item: ExerciseProgress }) {
  const diff = item.first_weight !== null && item.last_weight !== null ? item.last_weight - item.first_weight : 0;
  return (
    <div className="row">
      <div className="row-body">
        <div className="row-title">{item.exercise}</div>
        <div className="row-meta">
          <span>{formatWeight(item.first_weight)} → {formatWeight(item.last_weight)}</span>
          <span>рекорд {formatWeight(item.best_weight)}</span>
          <span>{item.records} {plural(item.records, "запись", "записи", "записей")}</span>
        </div>
      </div>
      {item.records > 1 && diff !== 0 && (
        <span className={`chip ${diff > 0 ? "" : "warn"}`}>
          {diff > 0 ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
          {diff > 0 ? "+" : "−"}{nf.format(Math.abs(diff))} кг
        </span>
      )}
    </div>
  );
}

function WorkoutForm({ workout, onClose, onSaved }: {
  workout: Workout | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { values, set, errors, formError, busy, submit } = useForm({
    weight_kg: workout?.weight_kg != null ? String(workout.weight_kg).replace(".", ",") : "",
    workout_name: workout?.workout_name ?? "",
    sets: String(workout?.sets ?? ""),
    reps: String(workout?.reps ?? ""),
    workout_time: String(workout?.workout_time ?? ""),
    time_between_sets: String(workout?.time_between_sets ?? "90"),
    to_failure: workout?.to_failure ?? false,
  });

  const save = () => submit(
    (v) => collect([
      ["workout_name", textLength(v.workout_name)],
      ["sets", intInRange(v.sets, 1, 100, "Подходы")],
      ["reps", intInRange(v.reps, 1, 1000, "Повторения")],
      ["workout_time", intInRange(v.workout_time, 1, 600, "Время")],
      ["time_between_sets", intInRange(v.time_between_sets, 0, 1800, "Отдых")],
      ["weight_kg", parseWeight(v.weight_kg).error],
    ]),
    async () => {
      const payload: WorkoutInput = {
        workout_name: values.workout_name.trim(),
        weight_kg: parseWeight(values.weight_kg).value,
        sets: Number(values.sets),
        reps: Number(values.reps),
        workout_time: Number(values.workout_time),
        time_between_sets: Number(values.time_between_sets),
        to_failure: values.to_failure,
      };
      if (workout) await api.updateWorkout(workout.id, payload);
      else await api.createWorkout(payload);
      onSaved(workout ? "Изменения сохранены" : "Тренировка добавлена");
    },
  );

  return (
    <Modal
      title={workout ? "Изменить тренировку" : "Новая тренировка"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Сохраняю…" : "Сохранить"}</button>
      </>}
    >
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <FormAlert message={formError} />
        <TextField className="span-2" label="Упражнение" placeholder="Жим лёжа" maxLength={100}
          value={values.workout_name} onChange={(e) => set("workout_name", e.target.value)} error={errors.workout_name} />
        <TextField className="span-2" label="Рабочий вес, кг" inputMode="decimal" placeholder="Например, 62,5"
          value={values.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} error={errors.weight_kg}
          hint="Оставьте пустым, если упражнение с собственным весом" />
        <TextField label="Подходы" inputMode="numeric" value={values.sets}
          onChange={(e) => set("sets", e.target.value)} error={errors.sets} />
        <TextField label="Повторения" inputMode="numeric" value={values.reps}
          onChange={(e) => set("reps", e.target.value)} error={errors.reps} />
        <TextField label="Длительность, мин" inputMode="numeric" value={values.workout_time}
          onChange={(e) => set("workout_time", e.target.value)} error={errors.workout_time} />
        <TextField label="Отдых между подходами, с" inputMode="numeric" value={values.time_between_sets}
          onChange={(e) => set("time_between_sets", e.target.value)} error={errors.time_between_sets} />
        <label className="check span-2">
          <input type="checkbox" checked={values.to_failure} onChange={(e) => set("to_failure", e.target.checked)} />
          Подходы до отказа
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
