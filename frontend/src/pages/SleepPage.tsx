import { useState } from "react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Moon, Pencil, Plus, Sun, Trash2 } from "lucide-react";
import { api } from "../api/client";
import type { DailyStat, SleepInput, SleepRecord } from "../api/types";
import { ConfirmDialog, EmptyState, FormAlert, Modal, SkeletonRows, TextField } from "../components/ui";
import { useToast } from "../components/Toast";
import { collect, intInRange, useForm, type FieldErrors } from "../lib/forms";
import {
  durationLabel, formatShortDay, formatTime, isoToLocalInput, localInputToIso, relativeDayLabel,
} from "../lib/format";
import { useDeleteRecord, useLoad } from "../lib/useLoad";

async function loadSleep(): Promise<{ records: SleepRecord[]; daily: DailyStat[] }> {
  const [records, daily] = await Promise.all([api.sleep(), api.daily(14)]);
  return { records, daily };
}

export function SleepPage() {
  const { data, loading, error, reload } = useLoad(loadSleep);
  const [editing, setEditing] = useState<SleepRecord | "new" | null>(null);
  const toast = useToast();

  const records = data?.records ?? [];
  const nights = records.filter((r) => !r.sleep_at_day).slice(0, 7);
  const avg = nights.length ? nights.reduce((a, r) => a + r.hours_of_sleep, 0) / nights.length : 0;

  const del = useDeleteRecord<SleepRecord>(api.deleteSleep, reload, toast);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Сон</h1>
          <p>Режим, длительность и привычки перед сном</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={18} aria-hidden /> Добавить</button>
      </header>

      <div className="grid-page">
        <section className="card" aria-label="Записи сна">
          {error && <FormAlert message={error.message} />}
          {loading ? <SkeletonRows count={4} /> : records.length === 0 ? (
            <EmptyState
              icon={<Moon size={26} />} title="Пока нет записей о сне"
              text="Добавьте прошлую ночь — появятся советы по режиму"
              action={<button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>Добавить сон</button>}
            />
          ) : (
            <div className="list">
              {records.map((r) => (
                <div className="row" key={r.id}>
                  <span className={`row-mark ${r.sleep_at_day ? "sand" : ""}`} aria-hidden />
                  <div className="row-body">
                    <div className="row-title">
                      {relativeDayLabel(r.wake_up_at)} · {durationLabel(r.go_to_bed_at, r.wake_up_at)}
                    </div>
                    <div className="row-meta">
                      <span>{formatTime(r.go_to_bed_at)} → {formatTime(r.wake_up_at)}</span>
                      <span>ел за {r.hours_since_last_meal} ч до сна</span>
                      {r.nap_hours_before_bed > 0 && <span>днём спал {r.nap_hours_before_bed} ч</span>}
                    </div>
                  </div>
                  {r.sleep_at_day
                    ? <span className="chip warn"><Sun size={14} aria-hidden /> днём</span>
                    : <span className={`chip ${r.hours_of_sleep < 7 || r.hours_of_sleep > 9 ? "warn" : ""}`}>{r.hours_of_sleep} ч</span>}
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => setEditing(r)} aria-label="Изменить запись сна"><Pencil size={18} /></button>
                    <button className="icon-btn danger" onClick={() => del.setTarget(r)} aria-label="Удалить запись сна"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="card" aria-label="Сон за две недели">
          <div className="card-title">Две недели</div>
          <div className="card-sub" style={{ marginBottom: 8 }}>
            {nights.length ? `В среднем ${avg.toFixed(1)} ч за последние ${nights.length} ноч.` : "Нет данных"} · цель 7–9 ч
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={data?.daily ?? []} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
                <XAxis dataKey="day" tickFormatter={(d) => formatShortDay(d).split(",")[1]?.trim() ?? d} tickLine={false} axisLine={false} tick={{ fill: "#5f6b65", fontSize: 11 }} interval={1} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#5f6b65", fontSize: 12 }} domain={[0, 12]} />
                <Tooltip
                  contentStyle={{ borderRadius: 14, border: "none", boxShadow: "0 10px 30px rgba(18,48,42,.15)" }}
                  cursor={{ fill: "#f4f4f0" }} labelFormatter={(d) => formatShortDay(String(d))}
                  formatter={(v) => [v == null ? "нет данных" : `${v} ч`, "Сон"]}
                />
                <ReferenceLine y={7} stroke="#c9a35c" strokeDasharray="4 4" />
                <Bar dataKey="sleep_hours" fill="#4c7a64" radius={[6, 6, 6, 6]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </aside>
      </div>

      {editing && (
        <SleepForm
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => { setEditing(null); toast(msg); await reload(); }}
        />
      )}
      {del.target && (
        <ConfirmDialog
          title="Удалить запись сна?"
          text="Запись будет удалена без возможности восстановления."
          busy={del.busy} onConfirm={del.confirm} onClose={del.cancel}
        />
      )}
    </>
  );
}

function defaultTimes(): { bed: string; wake: string } {
  const wake = new Date();
  wake.setHours(7, 0, 0, 0);
  if (wake > new Date()) wake.setDate(wake.getDate() - 1); // ещё нет 7 утра — берём вчерашнее утро
  const bed = new Date(wake);
  bed.setDate(bed.getDate() - 1);
  bed.setHours(23, 0, 0, 0);
  return { bed: isoToLocalInput(bed.toISOString()), wake: isoToLocalInput(wake.toISOString()) };
}

// Те же правила, что validate_sleep_interval на бэкенде
function intervalErrors(bed: string, wake: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!bed) errors.go_to_bed_at = "Укажите время";
  if (!wake) errors.wake_up_at = "Укажите время";
  if (!bed || !wake) return errors;
  const b = new Date(bed).getTime();
  const w = new Date(wake).getTime();
  if (w <= b) errors.wake_up_at = "Подъём должен быть позже отхода ко сну";
  else if (w > Date.now()) errors.wake_up_at = "Время подъёма не может быть в будущем";
  else if (w - b > 24 * 3600e3) errors.wake_up_at = "Сон не может длиться больше 24 часов";
  return errors;
}

function SleepForm({ record, onClose, onSaved }: { record: SleepRecord | null; onClose: () => void; onSaved: (m: string) => void }) {
  const defaults = defaultTimes();
  const { values, set, errors, formError, busy, submit } = useForm({
    go_to_bed_at: record ? isoToLocalInput(record.go_to_bed_at) : defaults.bed,
    wake_up_at: record ? isoToLocalInput(record.wake_up_at) : defaults.wake,
    sleep_at_day: record?.sleep_at_day ?? false,
    nap_hours_before_bed: String(record?.nap_hours_before_bed ?? "0"),
    hours_since_last_meal: String(record?.hours_since_last_meal ?? "3"),
  });

  const live = intervalErrors(values.go_to_bed_at, values.wake_up_at);
  const duration = !Object.keys(live).length
    ? durationLabel(localInputToIso(values.go_to_bed_at), localInputToIso(values.wake_up_at))
    : null;

  const save = () => submit(
    (v) => ({
      ...intervalErrors(v.go_to_bed_at, v.wake_up_at),
      ...collect([
        ["nap_hours_before_bed", intInRange(v.nap_hours_before_bed, 0, 12, "Дневной сон")],
        ["hours_since_last_meal", intInRange(v.hours_since_last_meal, 0, 24, "Часы")],
      ]),
    }),
    async () => {
      const payload: SleepInput = {
        go_to_bed_at: localInputToIso(values.go_to_bed_at),
        wake_up_at: localInputToIso(values.wake_up_at),
        sleep_at_day: values.sleep_at_day,
        nap_hours_before_bed: Number(values.nap_hours_before_bed),
        hours_since_last_meal: Number(values.hours_since_last_meal),
      };
      if (record) await api.updateSleep(record.id, payload);
      else await api.createSleep(payload);
      onSaved(record ? "Изменения сохранены" : "Сон добавлен");
    },
  );

  return (
    <Modal
      title={record ? "Изменить запись сна" : "Новая запись сна"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Сохраняю…" : "Сохранить"}</button>
      </>}
    >
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <FormAlert message={formError} />
        <TextField label="Лёг спать" type="datetime-local" value={values.go_to_bed_at}
          max={isoToLocalInput(new Date().toISOString())}
          onChange={(e) => set("go_to_bed_at", e.target.value)} error={errors.go_to_bed_at} />
        <TextField label="Проснулся" type="datetime-local" value={values.wake_up_at}
          max={isoToLocalInput(new Date().toISOString())}
          onChange={(e) => set("wake_up_at", e.target.value)} error={errors.wake_up_at}
          hint={duration ? `Длительность: ${duration}` : undefined} />
        <TextField label="Часов от еды до сна" inputMode="numeric" value={values.hours_since_last_meal}
          onChange={(e) => set("hours_since_last_meal", e.target.value)} error={errors.hours_since_last_meal} />
        <TextField label="Спал днём перед этим, ч" inputMode="numeric" value={values.nap_hours_before_bed}
          onChange={(e) => set("nap_hours_before_bed", e.target.value)} error={errors.nap_hours_before_bed} />
        <label className="check span-2">
          <input type="checkbox" checked={values.sleep_at_day} onChange={(e) => set("sleep_at_day", e.target.checked)} />
          Это дневной сон
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
