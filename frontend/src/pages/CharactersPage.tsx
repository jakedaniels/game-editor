import { useEffect, useState } from 'react';
import { api, type Character } from '../api/client';
import './Characters.css';

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.GET('/api/characters').then(({ data, error }) => {
      if (error || !data) return setError('Failed to load characters');
      setError(null);
      setCharacters(data);
    });
  }, []);

  return (
    <div className="characters-page">
      <h1 className="characters-page__title">Characters</h1>
      {error && <p className="characters-page__error">{error}</p>}
      {!error && characters.length === 0 && (
        <p className="characters-page__empty">No characters yet.</p>
      )}
      <div className="characters-grid">
        {characters.map((c) => (
          <div key={c.id} className="character-card">
            <div className="character-card__avatar">{c.name[0] ?? '?'}</div>
            <div className="character-card__name">{c.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
