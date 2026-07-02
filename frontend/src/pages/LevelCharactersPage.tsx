import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Level, type LevelCharacter } from '../api/client';
import './LevelCharacters.css';

export default function LevelCharactersPage() {
  const { projectId, levelId } = useParams();
  const [level, setLevel] = useState<Level | null>(null);
  const [characters, setCharacters] = useState<LevelCharacter[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!levelId) return;
    const id = Number(levelId);
    api
      .GET('/api/levels/{level_id}', { params: { path: { level_id: id } } })
      .then(({ data }) => data && setLevel(data));
    api
      .GET('/api/levels/{level_id}/characters', { params: { path: { level_id: id } } })
      .then(({ data, error }) => {
        if (error || !data) return setError('Failed to load characters');
        setError(null);
        setCharacters(data);
      });
  }, [levelId]);

  return (
    <div className="level-characters">
      <Link to={`/projects/${projectId}/levels/${levelId}`} className="level-characters__back">
        ← {level?.name ?? 'Level'}
      </Link>
      <h1 className="level-characters__title">Characters</h1>
      <p className="level-characters__lead">
        Deduced from who speaks this level's dialogue. Add a speaker to a line in the Dialogue
        editor and they'll appear here.
      </p>
      {error && <p className="level-characters__error">{error}</p>}
      {!error && characters.length === 0 && (
        <p className="level-characters__empty">
          No characters yet — assign speakers to dialogue to populate this list.
        </p>
      )}

      <div className="level-characters__list">
        {characters.map((c) => (
          <section key={c.id} className="lc-card">
            <header className="lc-card__head">
              <div className="lc-card__avatar">
                {c.image_url ? (
                  <img className="lc-card__avatar-img" src={c.image_url} alt="" />
                ) : (
                  (c.name[0] ?? '?').toUpperCase()
                )}
              </div>
              <div className="lc-card__id">
                <Link
                  to={`/projects/${projectId}/characters/${c.id}`}
                  className="lc-card__name"
                >
                  {c.name}
                </Link>
                {c.description && <div className="lc-card__desc">{c.description}</div>}
                <div className="lc-card__count">
                  {c.lines.length} line{c.lines.length === 1 ? '' : 's'}
                </div>
              </div>
            </header>

            <div className="lc-card__section">
              <h3 className="lc-card__section-title">Dialogue</h3>
              <ul className="lc-lines">
                {c.lines.map((l) => (
                  <li key={l.id} className="lc-line">
                    <span className="lc-line__scene">{l.scene_name}</span>
                    <span className="lc-line__text">{l.text || '(no text)'}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lc-card__section lc-card__section--soon">
              <h3 className="lc-card__section-title">Actions</h3>
              <div className="lc-card__placeholder">— to be filled in later —</div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
