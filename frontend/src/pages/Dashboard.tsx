import { Link } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Beef, Dumbbell, Flame, Lightbulb, Moon, Sparkles, UserRound, Utensils } from "lucide-react";
import { api } from "../api/client";
import type { DailyStat, Meal, Recommendation, SleepRecord, Summary, Targets } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { EmptyState, ProgressBar, Ring, SkeletonRows } from "../components/ui";
import { ageFrom, formatShortDay, formatToday, GOAL_LABEL, isProfileComplete, isToday, nf, plural } from "../lib/format";
import { useLoad } from "../lib/useLoad";

interface DashboardData {
  targets: Targets | null;
  summary: Summary | null;
  daily: DailyStat[];
  recommendations: Recommendation[] | null;
  meals: Meal[];
  sleep: SleepRecord[];
}

// Каждый запрос обрабатываем отдельно (allSettled): если один упал,
// остальные карточки всё равно покажутся
async function loadDashboard(profileComplete: boolean): Promise<DashboardData> {
  // без заполненного профиля нормы и советы не запрашиваем — сервер всё равно ответит 400
  const skip = Promise.reject(new Error("profile incomplete"));
  skip.catch(() => {});
  const [targets, summary, daily, recommendations, meals, sleep] = await Promise.allSettled([
    profileComplete ? api.targets() : skip, api.summary(), api.daily(7),
    profileComplete ? api.recommendations() : skip, api.meals(), api.sleep(),
  ]);
  const value = <T,>(r: PromiseSettledResult<T>, fallback: T) => (r.status === "fulfilled" ? r.value : fallback);
  if (meals.status === "rejected") throw meals.reason;
  return {
    targets: value(targets, null),
    summary: value(summary, null),
    daily: value(daily, []),
    recommendations: value(recommendations, null),
    meals: value(meals, []),
    sleep: value(sleep, []),
  };
}

const tooltipStyle = {
  borderRadius: 14, border: "none", boxShadow: "0 10px 30px rgba(18,48,42,.15)", fontFamily: "inherit",
};

export function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useLoad(() => loadDashboard(isProfileComplete(user)));

  const todayMeals = data?.meals.filter((m) => isToday(m.date)) ?? [];
  const sum = (key: "calories" | "protein" | "fats" | "carbs") => todayMeals.reduce((acc, m) => acc + m[key], 0);
  const calories = sum("calories");
  const protein = sum("protein");
  const FRESH_SLEEP_MS = 48 * 3600 * 1000; // как FRESH_SLEEP_LIMIT в recommendations.py
  const latestNight = data?.sleep.find((s) => !s.sleep_at_day);
  const lastNight = latestNight && Date.now() - new Date(latestNight.wake_up_at).getTime() <= FRESH_SLEEP_MS
    ? latestNight : undefined;
  const targets = data?.targets;
  const profileIncomplete = !loading && !targets;

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Привет, {user?.username}!</h1>
          <p>{formatToday()} · вот как проходит твой день</p>
        </div>
        <div className="topbar-actions">
          <Link to="/nutrition" className="btn btn-ghost btn-sm"><Utensils size={16} aria-hidden /> Приём пищи</Link>
          <Link to="/workouts" className="btn btn-primary btn-sm"><Dumbbell size={16} aria-hidden /> Тренировка</Link>
        </div>
      </header>

      {error && <div className="alert" role="alert">{error.message}</div>}

      {profileIncomplete && (
        <div className="card accent" style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div className="kpi-icon"><UserRound size={24} aria-hidden /></div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Заполните профиль</div>
            <div style={{ opacity: 0.85 }}>Нужны вес, рост, пол, дата рождения, активность и цель — тогда появятся нормы КБЖУ и персональные советы.</div>
          </div>
          <Link to="/profile" className="btn btn-ghost">Заполнить</Link>
        </div>
      )}

      {/* ---- KPI ---- */}
      <section className="grid-kpi" aria-label="Показатели за сегодня">
        <div className="card kpi-card">
          <div className="kpi">
            <div className="kpi-icon sand"><Flame size={24} aria-hidden /></div>
            <div className="kpi-text">
              <div className="kpi-label">Калории сегодня</div>
              <div className="kpi-value">{nf.format(calories)}{targets && <small>/ {nf.format(targets.target_calories)}</small>}</div>
            </div>
          </div>
          {targets && <ProgressBar value={calories} max={targets.target_calories} label="Калории от нормы" />}
        </div>
        <div className="card kpi-card">
          <div className="kpi">
            <div className="kpi-icon"><Beef size={24} aria-hidden /></div>
            <div className="kpi-text">
              <div className="kpi-label">Белок сегодня</div>
              <div className="kpi-value">{protein}<small>{targets ? `/ ${targets.target_protein_g} г` : "г"}</small></div>
            </div>
          </div>
          {targets && <ProgressBar value={protein} max={targets.target_protein_g} label="Белок от нормы" />}
        </div>
        <div className="card kpi-card">
          <div className="kpi">
            <div className="kpi-icon"><Moon size={24} aria-hidden /></div>
            <div className="kpi-text">
              <div className="kpi-label">Сон прошлой ночью</div>
              <div className="kpi-value">
                {lastNight ? <>{lastNight.hours_of_sleep}<small>ч</small></> : "—"}
                {lastNight && (
                  <span className={`chip ${lastNight.hours_of_sleep < 7 || lastNight.hours_of_sleep > 9 ? "warn" : ""}`}>
                    {lastNight.hours_of_sleep < 7 ? "мало" : lastNight.hours_of_sleep > 9 ? "много" : "норма"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="card accent kpi-card">
          <div className="kpi">
            <div className="kpi-icon"><Dumbbell size={24} aria-hidden /></div>
            <div className="kpi-text">
              <div className="kpi-label">Упражнений за неделю</div>
              <div className="kpi-value">
                {data?.summary?.workouts_this_week ?? 0}
                <small>{plural(data?.summary?.workouts_this_week ?? 0, "упражнение", "упражнения", "упражнений")}</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid-dash">
        {/* ---- Калории за 7 дней ---- */}
        <div className="card span-3">
          <div className="card-head">
            <div>
              <div className="card-title">Калории за неделю</div>
              <div className="card-sub">
                В среднем {nf.format(Math.round(data?.summary?.avg_calories_per_day ?? 0))} ккал в день
                {targets && ` · норма ${nf.format(targets.target_calories)}`}
              </div>
            </div>
            {targets && <span className="chip">{GOAL_LABEL[targets.target_goal]}</span>}
          </div>
          {loading ? <SkeletonRows count={4} /> : !data?.daily.some((d) => d.calories > 0) ? (
            <EmptyState
              icon={<Utensils size={24} />} title="За неделю нет приёмов пищи"
              text="Добавьте первый — здесь появится график"
              action={<Link to="/nutrition" className="btn btn-primary btn-sm">Добавить приём пищи</Link>}
            />
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <AreaChart data={data?.daily} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="calFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4c7a64" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#4c7a64" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#ecebe6" />
                  <XAxis dataKey="day" tickFormatter={formatShortDay} tickLine={false} axisLine={false} tick={{ fill: "#5f6b65", fontSize: 13 }} />
                  <YAxis
                    tickLine={false} axisLine={false} tick={{ fill: "#5f6b65", fontSize: 13 }} width={52}
                    // ось должна вмещать и данные, и линию нормы — иначе линия пропадает
                    domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, targets?.target_calories ?? 0) * 1.1 / 100) * 100 || 100]}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(d) => formatShortDay(String(d))}
                    formatter={(v) => [`${nf.format(Number(v))} ккал`, "Калории"]}
                  />
                  {targets && (
                    <ReferenceLine y={targets.target_calories} stroke="#c9a35c" strokeDasharray="6 6"
                      label={{ value: "норма", position: "insideTopRight", fill: "#7a5f2c", fontSize: 12 }} />
                  )}
                  <Area type="monotone" dataKey="calories" stroke="#2f5d4a" strokeWidth={2.5} fill="url(#calFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ---- Кольцо нормы ---- */}
        <div className="card">
          <div className="card-title">Норма на сегодня</div>
          <div className="card-sub" style={{ marginBottom: 12 }}>калории от суточной нормы</div>
          {targets ? (
            <>
              <div style={{ display: "grid", placeItems: "center" }}>
                <Ring value={calories} max={targets.target_calories}>
                  <div className="ring-value">{Math.round((calories / targets.target_calories) * 100)}%</div>
                  <div className="ring-caption">{nf.format(calories)} ккал</div>
                </Ring>
              </div>
              <div className="macro">
                <div><b>{protein}</b><span>из {targets.target_protein_g} г белка</span></div>
                <div><b>{sum("fats")}</b><span>из {targets.target_fat_g} г жиров</span></div>
                <div><b>{sum("carbs")}</b><span>из {targets.target_carbs_g} г углев.</span></div>
              </div>
            </>
          ) : (
            <EmptyState icon={<Flame size={24} />} title="Нет нормы" text="Заполните профиль" />
          )}
        </div>

        {/* ---- Рекомендации ---- */}
        <div className="card span-2">
          <div className="card-head">
            <div className="card-title">Рекомендации</div>
            <Sparkles size={20} color="var(--green-600)" aria-hidden />
          </div>
          {loading ? <SkeletonRows /> : data?.recommendations ? (
            data.recommendations.length ? (
              <div>
                {data.recommendations.map((r, i) => (
                  <div className="advice" key={i}>
                    <div className={`advice-icon ${r.category === "nutrition" ? "sand" : ""}`}>
                      {r.category === "sleep" ? <Moon size={18} aria-hidden />
                        : r.category === "workout" ? <Dumbbell size={18} aria-hidden />
                        : <Utensils size={18} aria-hidden />}
                    </div>
                    <p>{r.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Lightbulb size={24} />} title="Всё отлично" text="Сегодня замечаний нет — так держать" />
            )
          ) : (
            <EmptyState icon={<Lightbulb size={24} />} title="Советы появятся после заполнения профиля" />
          )}
        </div>

        {/* ---- Сон за неделю ---- */}
        <div className="card">
          <div className="card-title">Сон за неделю</div>
          <div className="card-sub" style={{ marginBottom: 8 }}>
            В среднем {data?.summary?.avg_hours_of_sleep ?? 0} ч ночью
          </div>
          {loading ? <SkeletonRows count={3} /> : (
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={data?.daily} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="day" tickFormatter={(d) => formatShortDay(d).split(",")[0]} tickLine={false} axisLine={false} tick={{ fill: "#5f6b65", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#5f6b65", fontSize: 12 }} domain={[0, 12]} />
                  <Tooltip
                    contentStyle={tooltipStyle} cursor={{ fill: "#f4f4f0" }}
                    labelFormatter={(d) => formatShortDay(String(d))}
                    formatter={(v) => [v == null ? "нет данных" : `${v} ч`, "Сон"]}
                  />
                  <ReferenceLine y={7} stroke="#c9a35c" strokeDasharray="4 4" />
                  <Bar dataKey="sleep_hours" fill="#4c7a64" radius={[8, 8, 8, 8]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ---- Профиль ---- */}
        <div className="card profile-card">
          <div className="avatar">{user?.username.charAt(0)}</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.username}</div>
          <div className="card-sub">{user?.email}</div>
          <div className="profile-stats">
            <div><span>Вес</span><b>{user?.weight ?? "—"}</b></div>
            <div><span>Рост</span><b>{user?.height ?? "—"}</b></div>
            <div><span>Возраст</span><b>{user?.birth_date ? ageFrom(user.birth_date) : "—"}</b></div>
          </div>
          <Link to="/profile" className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>Редактировать</Link>
        </div>
      </section>
    </>
  );
}
