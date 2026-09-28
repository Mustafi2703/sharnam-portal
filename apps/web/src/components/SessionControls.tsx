import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { IconMoon, IconSun } from "./icons";
import { getColorMode, MODULE_THEME_EVENT, notifyModuleTheme, toggleColorMode } from "../themes";

/** Light/dark and log out — shown on the main desk and every tool window. */
export function SessionControls() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [dark, setDark] = useState(() => getColorMode() === "dark");

  useEffect(() => {
    const sync = () => setDark(getColorMode() === "dark");
    window.addEventListener(MODULE_THEME_EVENT, sync);
    return () => window.removeEventListener(MODULE_THEME_EVENT, sync);
  }, []);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-ink hover:bg-brand-soft"
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => {
          toggleColorMode();
          setDark(getColorMode() === "dark");
          notifyModuleTheme();
        }}
      >
        {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
      </button>
      <button
        type="button"
        className="inline-flex h-8 items-center justify-center rounded-lg border border-line bg-paper px-2.5 text-xs font-semibold text-ink hover:bg-brand-soft"
        onClick={() => {
          logout();
          navigate("/login");
        }}
      >
        Log out
      </button>
    </>
  );
}
