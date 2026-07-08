import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Character, type Level, type Location, type Scene } from '../api/client';
import './Locations.css';

export default function LocationsPage() {
  const { projectId, levelId } = useParams();
  const navigate = useNavigate();
  const [level, setLevel] = useState<Level | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!levelId) return;
    const id = Number(levelId);
    api
      .GET('/api/levels/{level_id}', { params: { path: { level_id: id } } })
      .then(({ data }) => data && setLevel(data));
    api
      .GET('/api/locations', { params: { query: { level_id: id } } })
      .then(({ data, error }) => {
        if (error || !data) return setError('Failed to load locations');
        setError(null);
        setLocations(data);
      });
    api.GET('/api/scenes').then(({ data }) => {
      if (data) setScenes(data.filter((s) => String(s.level_id) === levelId));
    });
  }, [levelId]);

  // Project characters power the "place a character here" dropdown.
  useEffect(() => {
    const query = projectId ? { project_id: Number(projectId) } : undefined;
    api.GET('/api/characters', { params: { query } }).then(({ data }) => data && setCharacters(data));
  }, [projectId]);

  function replaceLocation(loc: Location) {
    setLocations((prev) => prev.map((l) => (l.id === loc.id ? loc : l)));
  }

  function startEdit(loc: Location) {
    setEditingId(loc.id);
    setDraft(loc.name);
  }

  async function saveEdit(id: number) {
    const name = draft.trim();
    if (!name) return;
    const { data, error } = await api.PATCH('/api/locations/{location_id}', {
      params: { path: { location_id: id } },
      body: { name },
    });
    if (error || !data) return setError('Failed to save location');
    setError(null);
    replaceLocation(data);
    setEditingId(null);
  }

  async function addLocation() {
    const { data, error } = await api.POST('/api/locations', {
      body: { name: 'New Location', description: '', level_id: levelId ? Number(levelId) : null },
    });
    if (error || !data) return setError('Failed to add location');
    setError(null);
    setLocations((prev) => [...prev, data]);
    startEdit(data); // let the user name it right away
  }

  async function deleteLocation(id: number) {
    const { error } = await api.DELETE('/api/locations/{location_id}', {
      params: { path: { location_id: id } },
    });
    if (error) return setError('Failed to delete location');
    setError(null);
    setLocations((prev) => prev.filter((l) => l.id !== id));
  }

  async function addCharacter(locationId: number, characterId: number) {
    const { data, error } = await api.POST('/api/locations/{location_id}/characters', {
      params: { path: { location_id: locationId } },
      body: { character_id: characterId },
    });
    if (error || !data) return setError('Failed to add character');
    setError(null);
    replaceLocation(data);
  }

  async function removeCharacter(locationId: number, characterId: number) {
    const { data, error } = await api.DELETE(
      '/api/locations/{location_id}/characters/{character_id}',
      { params: { path: { location_id: locationId, character_id: characterId } } },
    );
    if (error || !data) return setError('Failed to remove character');
    setError(null);
    replaceLocation(data);
  }

  async function addScene(locationId: number) {
    if (!levelId) return;
    const { data, error } = await api.POST('/api/scenes', {
      body: { name: 'New Scene', level_id: Number(levelId), location_id: locationId },
    });
    if (error || !data) return setError('Failed to add scene');
    setError(null);
    setScenes((prev) => [...prev, data]);
  }

  const dialogueHref = `/projects/${projectId}/levels/${levelId}/dialogue`;

  return (
    <div className="locations-page">
      <Link to={`/projects/${projectId}/levels/${levelId}`} className="locations-page__back">
        ← {level?.name ?? 'Level'}
      </Link>
      <div className="locations-page__head">
        <h1 className="locations-page__title">Locations</h1>
        <button type="button" className="btn btn--add" onClick={addLocation}>
          ＋ New location
        </button>
      </div>
      <p className="locations-page__lead">
        Places within this level. Say who's present at each, and create the scenes that happen there.
      </p>
      {error && <p className="locations-page__error">{error}</p>}
      {!error && locations.length === 0 && (
        <p className="locations-page__empty">No locations yet — add your first.</p>
      )}

      <div className="locations-page__list">
        {locations.map((loc) => {
          const presentIds = new Set(loc.characters.map((c) => c.id));
          const available = characters.filter((c) => !presentIds.has(c.id));
          const locScenes = scenes.filter((s) => s.location_id === loc.id);
          return (
            <section key={loc.id} className="loc-card">
              <header className="loc-card__head">
                {editingId === loc.id ? (
                  <form
                    className="loc-card__edit"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveEdit(loc.id);
                    }}
                  >
                    <input
                      className="loc-card__input"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Location name…"
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
                    <span className="loc-card__icon">📍</span>
                    <h2 className="loc-card__name">{loc.name}</h2>
                    <div className="loc-card__actions">
                      <button type="button" className="btn" onClick={() => startEdit(loc)}>
                        Rename
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => deleteLocation(loc.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </header>

              <div className="loc-card__section">
                <h3 className="loc-card__section-title">Characters here</h3>
                <div className="loc-chips">
                  {loc.characters.length === 0 && (
                    <span className="loc-chips__empty">Nobody here yet.</span>
                  )}
                  {loc.characters.map((c) => (
                    <span key={c.id} className="loc-chip">
                      {c.name}
                      <button
                        type="button"
                        className="loc-chip__remove"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => removeCharacter(loc.id, c.id)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                {available.length > 0 && (
                  <select
                    className="loc-card__select"
                    value=""
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val) addCharacter(loc.id, val);
                    }}
                  >
                    <option value="">＋ Add character…</option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="loc-card__section">
                <h3 className="loc-card__section-title">Scenes here</h3>
                <ul className="loc-scenes">
                  {locScenes.length === 0 && (
                    <li className="loc-scenes__empty">No scenes here yet.</li>
                  )}
                  {locScenes.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="loc-scene"
                        onClick={() => navigate(dialogueHref)}
                      >
                        <span className="loc-scene__name">{s.name}</span>
                        <span className="loc-scene__chevron">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn--add loc-card__add-scene"
                  onClick={() => addScene(loc.id)}
                >
                  ＋ New scene
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
