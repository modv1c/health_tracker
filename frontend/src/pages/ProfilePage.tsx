import { useState } from "react";
import { Flame, LogOut, Trash2 } from "lucide-react";
import { api } from "../api/client";
import type { ActivityLevel, Gender, Goal, ProfileUpdate } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { FormAlert, Modal, SelectField, TextField } from "../components/ui";
import { useToast } from "../components/Toast";
import { collect, intInRange, useForm, type FieldErrors } from "../lib/forms";
import { ACTIVITY_LABEL, ageFrom, GENDER_LABEL, GOAL_LABEL, isProfileComplete, nf } from "../lib/format";
import { errorText, useLoad } from "../lib/useLoad";

const options = <T extends string>(labels: Record<T, string>) => [
  { value: "", label: "Не выбрано" },
  ...(Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label })),
];

export function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const targets = useLoad(() => (isProfileComplete(user) ? api.targets() : Promise.resolve(null)));
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { values, set, errors, formError, busy, submit } = useForm({
    weight: user?.weight != null ? String(user.weight) : "",
    height: user?.height != null ? String(user.height) : "",
    gender: user?.gender ?? "",
    birth_date: user?.birth_date ?? "",
    activity_level: user?.activity_level ?? "",
    current_goal: user?.current_goal ?? "",
  });

  const validate = (v: typeof values): FieldErrors => {
    const found = collect([
      ["weight", v.weight ? intInRange(v.weight, 30, 300, "Вес") : null],
      ["height", v.height ? intInRange(v.height, 100, 250, "Рост") : null],
    ]);
    if (v.birth_date) {
      if (new Date(v.birth_date) > new Date()) found.birth_date = "Дата в будущем";
      else {
        const age = ageFrom(v.birth_date);
        if (age < 10 || age > 100) found.birth_date = "Возраст должен быть от 10 до 100 лет";
      }
    }
    return found;
  };

  const save = () => submit(validate, async () => {
    // пустое поле -> null: так пользователь может очистить значение
    const payload: ProfileUpdate = {
      weight: values.weight ? Number(values.weight) : null,
      height: values.height ? Number(values.height) : null,
      gender: (values.gender || null) as Gender | null,
      birth_date: values.birth_date || null,
      activity_level: (values.activity_level || null) as ActivityLevel | null,
      current_goal: (values.current_goal || null) as Goal | null,
    };
    const updated = await api.updateMe(payload);
    setUser(updated);
    if (isProfileComplete(updated)) await targets.reload();
    else targets.setData(null);
    toast("Профиль сохранён");
  });

  const t = targets.data;

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Профиль</h1>
          <p>{user?.username} · {user?.email}</p>
        </div>
        <button className="btn btn-ghost" onClick={logout}><LogOut size={18} aria-hidden /> Выйти</button>
      </header>

      <div className="grid-page">
        <section className="card" aria-label="Данные профиля">
          <div className="card-title">Параметры</div>
          <div className="card-sub" style={{ marginBottom: 18 }}>По ним считаются нормы КБЖУ (формула Миффлина — Сан Жеора)</div>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
            <FormAlert message={formError} />
            <TextField label="Вес, кг" inputMode="numeric" value={values.weight}
              onChange={(e) => set("weight", e.target.value)} error={errors.weight} />
            <TextField label="Рост, см" inputMode="numeric" value={values.height}
              onChange={(e) => set("height", e.target.value)} error={errors.height} />
            <SelectField label="Пол" value={values.gender} options={options(GENDER_LABEL)}
              onChange={(e) => set("gender", e.target.value)} error={errors.gender} />
            <TextField label="Дата рождения" type="date" value={values.birth_date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set("birth_date", e.target.value)} error={errors.birth_date} />
            <SelectField className="span-2" label="Активность" value={values.activity_level} options={options(ACTIVITY_LABEL)}
              onChange={(e) => set("activity_level", e.target.value)} error={errors.activity_level} />
            <SelectField className="span-2" label="Цель" value={values.current_goal} options={options(GOAL_LABEL)}
              onChange={(e) => set("current_goal", e.target.value)} error={errors.current_goal} />
            <div className="span-2">
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Сохраняю…" : "Сохранить"}</button>
            </div>
          </form>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <aside className="card accent" aria-label="Нормы">
            <div className="kpi" style={{ marginBottom: 14 }}>
              <div className="kpi-icon"><Flame size={22} aria-hidden /></div>
              <div>
                <div className="kpi-label">Норма калорий</div>
                <div className="kpi-value">{t ? nf.format(t.target_calories) : "—"}<small>ккал</small></div>
              </div>
            </div>
            {t ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, textAlign: "center" }}>
                {[["Белки", t.target_protein_g], ["Жиры", t.target_fat_g], ["Углеводы", t.target_carbs_g]].map(([label, v]) => (
                  <div key={label} style={{ background: "rgba(255,255,255,.12)", borderRadius: 14, padding: 10 }}>
                    <b style={{ fontSize: 18, display: "block" }}>{v} г</b>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>{label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ opacity: 0.9 }}>Заполните все поля слева — и здесь появятся ваши нормы.</p>
            )}
          </aside>

          <aside className="card" aria-label="Удаление аккаунта">
            <div className="card-title">Удалить аккаунт</div>
            <p className="card-sub" style={{ margin: "6px 0 14px" }}>
              Вместе с аккаунтом удалятся все тренировки, питание и сон.
            </p>
            <button className="btn btn-ghost" style={{ color: "var(--danger)" }} onClick={() => setDeleteOpen(true)}>
              <Trash2 size={18} aria-hidden /> Удалить аккаунт
            </button>
          </aside>
        </div>
      </div>

      {deleteOpen && <DeleteAccount username={user?.username ?? ""} onClose={() => setDeleteOpen(false)} onDeleted={logout} />}
    </>
  );
}

function DeleteAccount({ username, onClose, onDeleted }: { username: string; onClose: () => void; onDeleted: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    try {
      await api.deleteMe();
      onDeleted();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Удалить аккаунт?"
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn btn-danger" disabled={typed !== username || busy} onClick={remove}>
          {busy ? "Удаляю…" : "Удалить навсегда"}
        </button>
      </>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormAlert message={error} />
        <p style={{ color: "var(--text-muted)" }}>
          Это действие нельзя отменить. Чтобы подтвердить, введите имя пользователя <b style={{ color: "var(--text)" }}>{username}</b>.
        </p>
        <TextField label="Имя пользователя" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </div>
    </Modal>
  );
}
