import { NavLink, Route, Routes } from 'react-router-dom';
import ShapeEditorPage from './pages/ShapeEditorPage';
import DialogueEditorPage from './pages/DialogueEditorPage';

function navClass({ isActive }: { isActive: boolean }) {
  return 'app__link' + (isActive ? ' app__link--active' : '');
}

export default function App() {
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
