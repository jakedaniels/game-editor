import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Level } from '../api/client';
import './Levels.css';

export default function LevelsPage() {
  const { projectId } = useParams();
  const [levels, setLevels] = useState<Level[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = projectId ? { project_id: Number(projectId) } : undefined;
    api.GET('/api/levels', { params: { query } }).then(({ data, error }) => {
      if (error || !data) return setError('Failed to load levels');
      setError(null);
      setLevels(data);
    });
  }, [projectId]);

  function startEdit(level: Level) {
    setEditingId(level.id);
    setDraft(level.name);
  }

  async function saveEdit(id: number) {
    const name = draft.trim();
    if (!name) return;
    const { data, error } = await api.PATCH('/api/levels/{level_id}', {
      params: { path: { level_id: id } },
      body: { name },
    });
    if (error || !data) return setError('Failed to save level');
    setError(null);
    setLevels((prev) => prev.map((l) => (l.id === id ? data : l)));
    setEditingId(null);
  }

  async function addLevel() {
    const { data, error } = await api.POST('/api/levels', {
      body: { name: 'New Level', project_id: projectId ? Number(projectId) : null },
    });
    if (error || !data) return setError('Failed to add level');
    setError(null);
    setLevels((prev) => [...prev, data]);
    startEdit(data); // let the user name it right away
  }

  const levelHref = (id: number) => `/projects/${projectId}/levels/${id}`;

  return (
    <div className="levels-page">
      <h1 className="levels-page__title">Levels</h1>
      {error && <p className="levels-page__error">{error}</p>}
      {!error && levels.length === 0 && <p className="levels-page__empty">No levels yet.</p>}

      <ul className="level-list">
        {levels.map((level) => (
          <li key={level.id} className="level-row">
            {editingId === level.id ? (
              <form
                className="level-row__edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit(level.id);
                }}
              >
                <input
                  className="level-row__input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Level title…"
                  autoFocus
                />
                <button type="submit" className="btn btn--primary">
                  Save
                </button>
                <button type="button" className="btn" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <Link to={levelHref(level.id)} className="level-row__name">
                  <span className="level-row__icon">🎬</span>
                  {level.name}
                </Link>
                <div className="level-row__actions">
                  <Link to={levelHref(level.id)} className="level-row__open">
                    Open →
                  </Link>
                  <button type="button" className="btn" onClick={() => startEdit(level)}>
                    Rename
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn--add levels-page__add" onClick={addLevel}>
        ＋ New level
      </button>
    </div>
  );
}
