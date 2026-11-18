import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Utensils } from "lucide-react";
import { api } from "../api/client";
import type { Meal, MealInput, Targets } from "../api/types";
import { ConfirmDialog, EmptyState, FormAlert, Modal, ProgressBar, SkeletonRows, TextField } from "../components/ui";
import { useToast } from "../components/Toast";
import { collect, intInRange, textLength, useForm } from "../lib/forms";
import { formatTime, groupByDay, isProfileComplete, isToday, nf, relativeDayLabel } from "../lib/format";
import { useAuth } from "../auth/AuthContext";
import { useDeleteRecord, useLoad } from "../lib/useLoad";

async function loadNutrition(profileComplete: boolean): Promise<{ meals: Meal[]; targets: Targets | null }> {
  const [meals, targets] = await Promise.all([
    api.meals(),
    profileComplete ? api.targets().catch(() => null) : Promise.resolve(null),
  ]);
  return { meals, targets };
}

export function NutritionPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => loadNutrition(isProfileComplete(user)));
  const [editing, setEditing] = useState<Meal | "new" | null>(null);
  const toast = useToast();

  const meals = useMemo(() => data?.meals ?? [], [data]);
  const targets = data?.targets ?? null;
  const groups = useMemo(() => groupByDay(meals, (m) => m.date), [meals]);
  const today = meals.filter((m) => isToday(m.date));
  const total = (key: "calories" | "protein" | "fats" | "carbs", list = today) => list.reduce((a, m) => a + m[key], 0);

  const del = useDeleteRecord<Meal>(api.deleteMeal, reload, toast);

  const macros: { key: "calories" | "protein" | "fats" | "carbs"; label: string; unit: string; target?: number }[] = [
    { key: "calories", label: "Калории", unit: "ккал", target: targets?.target_calories },
    { key: "protein", label: "Белки", unit: "г", target: targets?.target_protein_g },
    { key: "fats", label: "Жиры", unit: "г", target: targets?.target_fat_g },
    { key: "carbs", label: "Углеводы", unit: "г", target: targets?.target_carbs_g },
  ];

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Питание</h1>
          <p>Приёмы пищи и КБЖУ за день</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={18} aria-hidden /> Добавить</button>
      </header>

      <div className="grid-page">
        <section className="card" aria-label="Приёмы пищи">
          {error && <FormAlert message={error.message} />}
          {loading ? <SkeletonRows count={4} /> : groups.length === 0 ? (
            <EmptyState
              icon={<Utensils size={26} />} title="Пока нет записей"
              text="Добавьте приём пищи, чтобы видеть калории и советы"
              action={<button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>Добавить приём пищи</button>}
            />
          ) : (
            <div className="list">
              {groups.map(([day, items]) => (
                <div key={day}>
                  <div className="list-group-title">
                    <span>{relativeDayLabel(items[0].date)}</span>
                    <span>{nf.format(total("calories", items))} ккал</span>
                  </div>
                  {items.map((m) => (
                    <div className="row" key={m.id}>
                      <span className="row-mark sand" aria-hidden />
                      <div className="row-body">
                        <div className="row-title">{m.meal_name}</div>
                        <div className="row-meta">
                          <span>Б {m.protein} · Ж {m.fats} · У {m.carbs}</span>
                          <span>{formatTime(m.date)}</span>
                        </div>
                      </div>
                      <span className="chip neutral">{nf.format(m.calories)} ккал</span>
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => setEditing(m)} aria-label={`Изменить «${m.meal_name}»`}><Pencil size={18} /></button>
                        <button className="icon-btn danger" onClick={() => del.setTarget(m)} aria-label={`Удалить «${m.meal_name}»`}><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="card" aria-label="Сегодня">
          <div className="card-title">Сегодня</div>
          <div className="card-sub" style={{ marginBottom: 16 }}>
            {targets ? "Съедено / норма по вашему профилю" : "Заполните профиль, чтобы увидеть нормы"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {macros.map(({ key, label, unit, target }) => (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                  <span>{label}</span>
                  <span>{nf.format(total(key))}{target ? ` / ${nf.format(target)}` : ""} {unit}</span>
                </div>
                {target ? <ProgressBar value={total(key)} max={target} label={`${label} от нормы`} /> : null}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {editing && (
        <MealForm
          meal={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => { setEditing(null); toast(msg); await reload(); }}
        />
      )}
      {del.target && (
        <ConfirmDialog
          title="Удалить приём пищи?"
          text={<>«{del.target.meal_name}» будет удалён без возможности восстановления.</>}
          busy={del.busy} onConfirm={del.confirm} onClose={del.cancel}
        />
      )}
    </>
  );
}

function MealForm({ meal, onClose, onSaved }: { meal: Meal | null; onClose: () => void; onSaved: (m: string) => void }) {
  const { values, set, errors, formError, busy, submit } = useForm({
    meal_name: meal?.meal_name ?? "",
    calories: String(meal?.calories ?? ""),
    protein: String(meal?.protein ?? ""),
    fats: String(meal?.fats ?? ""),
    carbs: String(meal?.carbs ?? ""),
  });

  // Подсказка: калории по формуле 4·Б + 9·Ж + 4·У
  const estimate = ["protein", "fats", "carbs"].every((k) => /^\d+$/.test(values[k as "protein"]))
    ? Number(values.protein) * 4 + Number(values.fats) * 9 + Number(values.carbs) * 4
    : null;

  const save = () => submit(
    (v) => collect([
      ["meal_name", textLength(v.meal_name)],
      ["calories", intInRange(v.calories, 0, 10000, "Калории")],
      ["protein", intInRange(v.protein, 0, 1000, "Белки")],
      ["fats", intInRange(v.fats, 0, 1000, "Жиры")],
      ["carbs", intInRange(v.carbs, 0, 1000, "Углеводы")],
    ]),
    async () => {
      const payload: MealInput = {
        meal_name: values.meal_name.trim(),
        calories: Number(values.calories),
        protein: Number(values.protein),
        fats: Number(values.fats),
        carbs: Number(values.carbs),
      };
      if (meal) await api.updateMeal(meal.id, payload);
      else await api.createMeal(payload);
      onSaved(meal ? "Изменения сохранены" : "Приём пищи добавлен");
    },
  );

  return (
    <Modal
      title={meal ? "Изменить приём пищи" : "Новый приём пищи"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Сохраняю…" : "Сохранить"}</button>
      </>}
    >
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <FormAlert message={formError} />
        <TextField className="span-2" label="Блюдо" placeholder="Овсянка с бананом" maxLength={100}
          value={values.meal_name} onChange={(e) => set("meal_name", e.target.value)} error={errors.meal_name} />
        <TextField label="Белки, г" inputMode="numeric" value={values.protein}
          onChange={(e) => set("protein", e.target.value)} error={errors.protein} />
        <TextField label="Жиры, г" inputMode="numeric" value={values.fats}
          onChange={(e) => set("fats", e.target.value)} error={errors.fats} />
        <TextField label="Углеводы, г" inputMode="numeric" value={values.carbs}
          onChange={(e) => set("carbs", e.target.value)} error={errors.carbs} />
        <TextField label="Калории, ккал" inputMode="numeric" value={values.calories}
          onChange={(e) => set("calories", e.target.value)} error={errors.calories}
          hint={estimate !== null ? `По БЖУ выходит ≈ ${estimate} ккал` : undefined} />
        {estimate !== null && values.calories === "" && (
          <button type="button" className="btn btn-ghost btn-sm span-2" onClick={() => set("calories", String(estimate))}>
            Подставить {estimate} ккал
          </button>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
