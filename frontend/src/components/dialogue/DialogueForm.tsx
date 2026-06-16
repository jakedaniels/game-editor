import { useState } from 'react';
import type { Character } from '../../api/client';

interface DialogueFormProps {
  characters: Character[];
  initialText?: string;
  initialCharacterId?: number | null;
  submitLabel: string;
  onSubmit: (text: string, characterId: number | null) => void;
  onCancel: () => void;
}

/** Shared editor for a dialogue's character + text, used for both "add" and "edit". */
export function DialogueForm({
  characters,
  initialText = '',
  initialCharacterId = null,
  submitLabel,
  onSubmit,
  onCancel,
}: DialogueFormProps) {
  const [text, setText] = useState(initialText);
  const [characterId, setCharacterId] = useState<number | null>(initialCharacterId);

  return (
    <form
      className="dialogue-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text.trim(), characterId);
      }}
    >
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
      <textarea
        className="dialogue-form__text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Dialogue text…"
        rows={3}
        autoFocus
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
