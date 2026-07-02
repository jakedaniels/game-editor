import { useState } from 'react';
import type { Character } from '../../api/client';

interface DialogueFormProps {
  characters: Character[];
  initialText?: string;
  initialCharacterId?: number | null;
  submitLabel: string;
  onSubmit: (text: string, characterId: number | null) => void;
  onCancel: () => void;
  /** When provided, the form can create a brand-new character inline and select it. */
  onCreateCharacter?: (name: string) => Promise<Character | null>;
}

/** Shared editor for a dialogue's character + text, used for both "add" and "edit". */
export function DialogueForm({
  characters,
  initialText = '',
  initialCharacterId = null,
  submitLabel,
  onSubmit,
  onCancel,
  onCreateCharacter,
}: DialogueFormProps) {
  const [text, setText] = useState(initialText);
  const [characterId, setCharacterId] = useState<number | null>(initialCharacterId);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  async function createCharacter() {
    if (!onCreateCharacter) return;
    const name = newName.trim();
    if (!name) return;
    const created = await onCreateCharacter(name);
    if (created) {
      setCharacterId(created.id); // speak as the new character
      setCreating(false);
      setNewName('');
    }
  }

  return (
    <form
      className="dialogue-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text.trim(), characterId);
      }}
    >
      {creating ? (
        <div className="dialogue-form__new">
          <input
            className="dialogue-form__new-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New character name…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                createCharacter();
              }
            }}
          />
          <button type="button" className="btn btn--primary" onClick={createCharacter}>
            Create
          </button>
          <button type="button" className="btn" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="dialogue-form__speaker">
          <select
            className="dialogue-form__select"
            value={characterId ?? ''}
            onChange={(e) => setCharacterId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— no character —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {onCreateCharacter && (
            <button
              type="button"
              className="btn btn--add"
              onClick={() => setCreating(true)}
              title="Write dialogue for a new character"
            >
              ＋ New
            </button>
          )}
        </div>
      )}

      <textarea
        className="dialogue-form__text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Dialogue text…"
        rows={3}
      />
      <div className="dialogue-form__actions">
        <button type="submit" className="btn btn--primary">
          {submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
