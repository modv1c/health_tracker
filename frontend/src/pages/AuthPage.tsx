import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Leaf } from "lucide-react";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { FormAlert, TextField } from "../components/ui";

type Mode = "login" | "register";
type Errors = Partial<Record<"username" | "email" | "password", string>>;

// Те же правила, что и в Pydantic-схеме UserCreate на бэкенде —
// чтобы показать ошибку сразу, не дожидаясь ответа сервера
function validate(mode: Mode, username: string, email: string, password: string): Errors {
  const errors: Errors = {};
  if (!username.trim()) errors.username = "Введите имя пользователя";
  else if (mode === "register") {
    if (username.length < 3 || username.length > 50) errors.username = "От 3 до 50 символов";
    else if (!/^[A-Za-z0-9_.-]+$/.test(username)) errors.username = "Только латиница, цифры и _ . -";
  }
  if (mode === "register") {
    if (!email.trim()) errors.email = "Введите email";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "Некорректный email";
  }
  if (!password) errors.password = "Введите пароль";
  else if (mode === "register" && password.length < 6) errors.password = "Минимум 6 символов";
  else if (mode === "register" && new TextEncoder().encode(password).length > 72) errors.password = "Слишком длинный пароль";
  return errors;
}

export function AuthPage({ mode }: { mode: Mode }) {
  const { login, register, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";

  const switchMode = () => {
    setErrors({});
    setFormError(null);
    navigate(isLogin ? "/register" : "/login");
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(mode, username, email, password);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      if (isLogin) await login(username.trim(), password);
      else await register(username.trim(), email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields as Errors);
        setFormError(Object.keys(err.fields).length ? null : err.message);
      } else {
        setFormError("Что-то пошло не так");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="auth-brand">
            <span className="logo-mark"><Leaf size={20} aria-hidden /></span>
            Health Tracker
          </div>
          <h1>{isLogin ? "Вход" : "Регистрация"}</h1>
          <p>{isLogin ? "Рады видеть снова. Продолжим следить за здоровьем." : "Тренировки, питание и сон — в одном месте."}</p>

          {sessionExpired && isLogin && !formError && (
            <FormAlert message="Сессия истекла — войдите снова" />
          )}
          <FormAlert message={formError} />

          <TextField
            label="Имя пользователя" autoComplete="username" value={username}
            onChange={(e) => setUsername(e.target.value)} error={errors.username}
          />
          {!isLogin && (
            <TextField
              label="Email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} error={errors.email}
            />
          )}
          <div className="field">
            <label htmlFor="password">Пароль</label>
            <div className="password-wrap">
              <input
                id="password" className="input" type={showPassword ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "password-err" : undefined}
              />
              <button
                type="button" className="icon-btn" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span id="password-err" className="field-error">{errors.password}</span>}
          </div>

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 6 }}>
            {busy ? "Подождите…" : isLogin ? "Войти" : "Создать аккаунт"}
          </button>

          <div className="auth-switch">
            {isLogin ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <button type="button" onClick={switchMode}>{isLogin ? "Зарегистрироваться" : "Войти"}</button>
          </div>
        </form>

        <div className="auth-art" aria-hidden>
          <LeafLayers />
          <div className="auth-quote">
            Маленькие привычки каждый день
            <span>сон, питание и тренировки — под контролем</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Многослойная "бумажная" композиция из волн и листьев. */
function LeafLayers() {
  const leaf = (x: number, y: number, r: number, s: number, fill: string, key: string) => (
    <g key={key} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0 C 40 -60 120 -70 200 -40 C 140 -10 70 20 0 0 Z" fill={fill} />
      <path d="M0 0 C 60 -20 120 -35 196 -40" stroke="rgba(255,255,255,0.28)" strokeWidth="3" fill="none" />
    </g>
  );
  return (
    <svg viewBox="0 0 520 620" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="paper" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="-10" dy="8" stdDeviation="10" floodColor="#12302a" floodOpacity="0.28" />
        </filter>
        <linearGradient id="deep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f5d4a" />
          <stop offset="1" stopColor="#12302a" />
        </linearGradient>
      </defs>
      <rect width="520" height="620" fill="url(#deep)" />
      {/* листья в глубине */}
      {leaf(140, 220, -30, 1.2, "#3f6f5a", "a")}
      {leaf(260, 420, -70, 1.1, "#4c7a64", "b")}
      {leaf(320, 160, 20, 1.0, "#5d8a72", "c")}
      {leaf(180, 560, -40, 1.3, "#3a6853", "d")}
      {leaf(380, 360, 160, 1.0, "#57846d", "e")}
      {/* бумажные слои — каждый светлее и ближе */}
      <path filter="url(#paper)" fill="#c9d6cd" d="M0 0 H190 C150 90 230 150 170 240 C120 320 210 380 160 470 C120 540 190 590 150 620 H0 Z" />
      <path filter="url(#paper)" fill="#dde6df" d="M0 0 H130 C95 80 165 140 115 230 C75 305 150 370 105 460 C70 530 130 580 100 620 H0 Z" />
      <path filter="url(#paper)" fill="#eef2ee" d="M0 0 H75 C50 70 105 130 70 215 C40 290 95 360 60 450 C35 520 80 575 55 620 H0 Z" />
      <path fill="#ffffff" d="M0 0 H28 C18 80 48 150 30 230 C14 300 42 380 24 460 C12 530 34 580 22 620 H0 Z" />
    </svg>
  );
}
