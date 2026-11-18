import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { WorkoutsPage } from "./pages/WorkoutsPage";
import { NutritionPage } from "./pages/NutritionPage";
import { SleepPage } from "./pages/SleepPage";
import { ProfilePage } from "./pages/ProfilePage";

export function App() {
  const { user, loading, startupError, retry } = useAuth();

  if (loading) {
    return (
      <div className="auth-page" aria-busy="true">
        <div className="skeleton" style={{ width: 220, height: 20 }} />
      </div>
    );
  }

  if (startupError) {
    return (
      <div className="auth-page">
        <div className="card" style={{ maxWidth: 420, textAlign: "center" }} role="alert">
          <div className="card-title" style={{ marginBottom: 8 }}>Сервер недоступен</div>
          <p className="card-sub" style={{ marginBottom: 18 }}>{startupError}</p>
          <button className="btn btn-primary" onClick={retry}>Повторить</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workouts" element={<WorkoutsPage />} />
        <Route path="/nutrition" element={<NutritionPage />} />
        <Route path="/sleep" element={<SleepPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
