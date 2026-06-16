import type { Character } from '../../api/client';

interface CharactersSidebarProps {
  characters: Character[];
}

/** Right sidebar listing characters as rounded pills (matching the sketch). */
export function CharactersSidebar({ characters }: CharactersSidebarProps) {
  return (
    <aside className="sidebar sidebar--right">
      <h2 className="sidebar__title">Characters</h2>
      <ul className="sidebar__list">
        {characters.map((c) => (
          <li key={c.id} className="character-pill">
            {c.name}
          </li>
        ))}
      </ul>
    </aside>
  );
}
