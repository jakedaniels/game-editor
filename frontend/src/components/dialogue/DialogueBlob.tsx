import { useState } from 'react';
import type { Character, DialogueDetail } from '../../api/client';
import { DialogueForm } from './DialogueForm';

interface DialogueBlobProps {
  detail: DialogueDetail;
  characters: Character[];
  onSave: (text: string, characterId: number | null) => void;
  onCreateCharacter?: (name: string) => Promise<Character | null>;
}

/**
 * The current dialogue, emphasized in the center of the stage. Shows a character
 * portrait placeholder, the speaker name, the dialogue text, and a metadata panel
 * (placeholders to be filled in later). The "Edit" button swaps the body for a form.
 */
export function DialogueBlob({ detail, characters, onSave, onCreateCharacter }: DialogueBlobProps) {
  const [editing, setEditing] = useState(false);

  return (
    <article className="dialogue-blob">
      {!editing && (
        <button
          type="button"
          className="dialogue-blob__edit"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      )}

      <div className="dialogue-blob__portrait" aria-hidden>
        {detail.character?.image_url ? (
          <img className="dialogue-blob__portrait-img" src={detail.character.image_url} alt="" />
        ) : (
          <span className="dialogue-blob__portrait-text">
            {detail.character?.name?.[0] ?? '?'}
          </span>
        )}
      </div>

      <div className="dialogue-blob__body">
        {editing ? (
          <DialogueForm
            characters={characters}
            initialText={detail.text}
            initialCharacterId={detail.character?.id ?? null}
            submitLabel="Save"
            onSubmit={(text, characterId) => {
              onSave(text, characterId);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            onCreateCharacter={onCreateCharacter}
          />
        ) : (
          <>
            <div className="dialogue-blob__speaker">{detail.character?.name ?? 'Unknown'}</div>
            <p className="dialogue-blob__text">{detail.text || '(no text)'}</p>

            <div className="dialogue-blob__meta">
              <span className="dialogue-blob__meta-label">Actions</span>
              <div className="dialogue-blob__meta-placeholder">— to be filled in later —</div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
