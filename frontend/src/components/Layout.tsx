import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Dumbbell, LayoutGrid, Leaf, LogOut, Moon, UserRound, Utensils } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/", label: "Обзор", icon: LayoutGrid },
  { to: "/workouts", label: "Тренировки", icon: Dumbbell },
  { to: "/nutrition", label: "Питание", icon: Utensils },
  { to: "/sleep", label: "Сон", icon: Moon },
  { to: "/profile", label: "Профиль", icon: UserRound },
];

const EXPANDED_KEY = "ht_sidebar_expanded";

function readExpanded(): boolean {
  try { return localStorage.getItem(EXPANDED_KEY) === "1"; } catch { return false; }
}

export function Layout() {
  const { logout } = useAuth();
  const [expanded, setExpanded] = useState(readExpanded);
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Белая "капсула" активного пункта плавно переезжает к новому пункту меню
  useLayoutEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>(".nav-link.active");
    if (!nav || !active) { setIndicator(null); return; }
    const place = () => setIndicator({ x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight });
    place();
    // ширина пункта меняется при сворачивании меню и на мобильной раскладке
    const observer = new ResizeObserver(place);
    observer.observe(active);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [location.pathname, expanded]);

  const toggle = () => {
    setExpanded((prev) => {
      try { localStorage.setItem(EXPANDED_KEY, prev ? "0" : "1"); } catch { /* не критично */ }
      return !prev;
    });
  };

  return (
    <div className="app">
      <nav ref={navRef} className={`sidebar ${expanded ? "expanded" : ""}`} aria-label="Основная навигация">
        {indicator && (
          <span className="nav-indicator" aria-hidden
            style={{ width: indicator.w, height: indicator.h, transform: `translate(${indicator.x}px, ${indicator.y}px)` }} />
        )}
        <div className="sidebar-logo">
          <span className="logo-mark"><Leaf size={22} aria-hidden /></span>
          <span className="sidebar-title">Health Tracker</span>
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className="nav-link" data-label={label} aria-label={label}>
            <Icon size={22} aria-hidden />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
        <div className="sidebar-spacer" />
        <button type="button" className="sidebar-toggle" onClick={toggle} aria-label={expanded ? "Свернуть меню" : "Развернуть меню"} aria-expanded={expanded}>
          {expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
        <button type="button" className="nav-btn" onClick={logout} data-label="Выйти" aria-label="Выйти">
          <LogOut size={22} aria-hidden />
          <span className="nav-label">Выйти</span>
        </button>
      </nav>
      <main className="main">
        {/* key по адресу: при переходе блок монтируется заново и проигрывает анимацию появления */}
        <div className="page" key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
