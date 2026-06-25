import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Project } from '../api/client';
import './Projects.css';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.GET('/api/projects').then(({ data, error }) => {
      if (error || !data) return setError('Failed to load projects');
      setError(null);
      setProjects(data);
    });
  }, []);

  function startEdit(project: Project) {
    setEditingId(project.id);
    setDraft(project.name);
  }

  async function saveEdit(id: number) {
    const name = draft.trim();
    if (!name) return;
    const { data, error } = await api.PATCH('/api/projects/{project_id}', {
      params: { path: { project_id: id } },
      body: { name },
    });
    if (error || !data) return setError('Failed to save project');
    setError(null);
    setProjects((prev) => prev.map((p) => (p.id === id ? data : p)));
    setEditingId(null);
  }

  async function addProject() {
    const { data, error } = await api.POST('/api/projects', { body: { name: 'New Project' } });
    if (error || !data) return setError('Failed to add project');
    setError(null);
    setProjects((prev) => [...prev, data]);
    startEdit(data); // let the user name it right away
  }

  return (
    <div className="projects-page">
      <div className="projects-page__hero">
        <h1 className="projects-page__title">game-editor</h1>
        <p className="projects-page__subtitle">Your games</p>
      </div>
      {error && <p className="projects-page__error">{error}</p>}
      {!error && projects.length === 0 && (
        <p className="projects-page__empty">No projects yet — create your first game.</p>
      )}

      <ul className="project-list">
        {projects.map((project) => (
          <li key={project.id} className="project-row">
            {editingId === project.id ? (
              <form
                className="project-row__edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit(project.id);
                }}
              >
                <input
                  className="project-row__input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Project name…"
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
                <Link to={`/projects/${project.id}`} className="project-row__name">
                  <span className="project-row__icon">🎮</span>
                  {project.name}
                  {project.genre && <span className="project-row__tag">{project.genre}</span>}
                </Link>
                <div className="project-row__actions">
                  <Link to={`/projects/${project.id}`} className="project-row__open">
                    Open →
                  </Link>
                  <button type="button" className="btn" onClick={() => startEdit(project)}>
                    Rename
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn--add projects-page__add" onClick={addProject}>
        ＋ New project
      </button>
    </div>
  );
}
