import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api, THEMES, type Theme } from './api/client';
import ShapeEditorPage from './pages/ShapeEditorPage';
import DialogueEditorPage from './pages/DialogueEditorPage';

const THEME_LABELS: Record<Theme, string> = { neon: 'Neon', aqua: 'Aqua', light: 'Light' };

function navClass({ isActive }: { isActive: boolean }) {
  return 'app__link' + (isActive ? ' app__link--active' : '');
}

export default function App() {
  const [theme, setTheme] = useState<Theme>('neon');

  // Load the user's saved theme on startup.
  useEffect(() => {
    api.GET('/api/user').then(({ data }) => {
      if (data && (THEMES as readonly string[]).includes(data.theme)) {
        setTheme(data.theme as Theme);
      }
    });
  }, []);

  // Apply the theme to <html> so the whole site (including the body background) updates.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function cycleTheme() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next); // optimistic
    api.PATCH('/api/user', { body: { theme: next } }); // persist on the user
  }

  return (
    <div className="app">
      <header className="app__nav">
        <span className="app__title">game-editor</span>
        <nav className="app__links">
          <NavLink to="/" end className={navClass}>
            Shapes
          </NavLink>
          <NavLink to="/dialogue" className={navClass}>
            Dialogue
          </NavLink>
        </nav>
        <button
          type="button"
          className="app__theme"
          onClick={cycleTheme}
          title="Change theme (saved to your profile)"
        >
          <span className="app__theme-swatch" />
          Theme: {THEME_LABELS[theme]}
        </button>
      </header>
      <main className="app__content">
        <Routes>
          <Route path="/" element={<ShapeEditorPage />} />
          <Route path="/dialogue" element={<DialogueEditorPage />} />
        </Routes>
      </main>
    </div>
  );
}
