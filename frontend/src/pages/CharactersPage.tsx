import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Character } from '../api/client';
import './Characters.css';

export default function CharactersPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = projectId ? { project_id: Number(projectId) } : undefined;
    api.GET('/api/characters', { params: { query } }).then(({ data, error }) => {
      if (error || !data) return setError('Failed to load characters');
      setError(null);
      setCharacters(data);
    });
  }, [projectId]);

  async function addCharacter() {
    const { data, error } = await api.POST('/api/characters', {
      body: {
        name: 'New Character',
        description: '',
        project_id: projectId ? Number(projectId) : null,
      },
    });
    if (error || !data) return setError('Failed to add character');
    setError(null);
    navigate(`/projects/${projectId}/characters/${data.id}`); // open detail to edit
  }

  return (
    <div className="characters-page">
      <div className="characters-page__head">
        <h1 className="characters-page__title">Characters</h1>
        <button type="button" className="btn btn--add" onClick={addCharacter}>
          ＋ New character
        </button>
      </div>
      {error && <p className="characters-page__error">{error}</p>}
      {!error && characters.length === 0 && (
        <p className="characters-page__empty">No characters yet — add your first.</p>
      )}
      <div className="characters-grid">
        {characters.map((c) => (
          <Link
            key={c.id}
            to={`/projects/${projectId}/characters/${c.id}`}
            className="character-card"
          >
            <div className="character-card__avatar">
              {c.image_url ? (
                <img className="character-card__avatar-img" src={c.image_url} alt="" />
              ) : (
                (c.name[0] ?? '?')
              )}
            </div>
            <div className="character-card__name">{c.name}</div>
            {c.description && <div className="character-card__desc">{c.description}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
