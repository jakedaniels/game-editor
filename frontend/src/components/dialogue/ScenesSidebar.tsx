import type { Scene } from '../../api/client';

interface ScenesSidebarProps {
  scenes: Scene[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/**
 * Left sidebar listing scenes, grouped under their level. Selecting a scene switches the
 * whole editor to that scene's dialogue tree.
 */
export function ScenesSidebar({ scenes, selectedId, onSelect }: ScenesSidebarProps) {
  // Group scenes by level name, preserving order.
  const byLevel = new Map<string, Scene[]>();
  for (const s of scenes) {
    const list = byLevel.get(s.level_name) ?? [];
    list.push(s);
    byLevel.set(s.level_name, list);
  }

  return (
    <aside className="sidebar sidebar--left">
      <h2 className="sidebar__title">Scenes</h2>
      {[...byLevel.entries()].map(([level, levelScenes]) => (
        <div key={level} className="sidebar__group">
          <div className="sidebar__group-header">{level.toUpperCase()}</div>
          <ul className="sidebar__list">
            {levelScenes.map((scene) => (
              <li key={scene.id}>
                <button
                  type="button"
                  className={
                    'scene-row' + (selectedId === scene.id ? ' scene-row--active' : '')
                  }
                  onClick={() => onSelect(scene.id)}
                >
                  <span>{scene.name}</span>
                  <span className="scene-row__chevron">›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
