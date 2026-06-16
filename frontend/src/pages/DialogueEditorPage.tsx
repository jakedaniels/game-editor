import { useCallback, useEffect, useState } from 'react';
import { api, type Character, type DialogueDetail, type Scene } from '../api/client';
import { ScenesSidebar } from '../components/dialogue/ScenesSidebar';
import { CharactersSidebar } from '../components/dialogue/CharactersSidebar';
import { DialogueBlob } from '../components/dialogue/DialogueBlob';
import { DialogueForm } from '../components/dialogue/DialogueForm';
import { ResponseWheel } from '../components/dialogue/ResponseWheel';
import '../components/dialogue/DialogueEditor.css';

export default function DialogueEditorPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneId, setSceneId] = useState<number | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DialogueDetail | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Characters power both the right sidebar and the form dropdowns.
  useEffect(() => {
    api.GET('/api/characters').then(({ data }) => data && setCharacters(data));
  }, []);

  // Load scenes and select the first one.
  useEffect(() => {
    api.GET('/api/scenes').then(({ data, error }) => {
      if (error || !data) return setError('Failed to load scenes');
      setScenes(data);
      if (data.length > 0) setSceneId(data[0].id);
    });
  }, []);

  // When the scene changes, load that scene's root dialogue (the page is scoped to a scene).
  useEffect(() => {
    if (sceneId == null) return;
    setAdding(false);
    api
      .GET('/api/dialogues', { params: { query: { scene_id: sceneId } } })
      .then(({ data, error }) => {
        if (error || !data) return setError('Failed to load dialogues');
        setError(null);
        setCurrentId(data[0]?.id ?? null); // null => empty scene
      });
  }, [sceneId]);

  const loadDialogue = useCallback((id: number) => {
    return api
      .GET('/api/dialogues/{dialogue_id}', { params: { path: { dialogue_id: id } } })
      .then(({ data, error }) => {
        if (error || !data) return setError('Failed to load dialogue');
        setError(null);
        setDetail(data);
      });
  }, []);

  // Load the focused dialogue (or clear it for an empty scene).
  useEffect(() => {
    if (currentId == null) {
      setDetail(null);
      return;
    }
    loadDialogue(currentId);
  }, [currentId, loadDialogue]);

  async function handleEdit(text: string, characterId: number | null) {
    if (currentId == null) return;
    const { data, error } = await api.PATCH('/api/dialogues/{dialogue_id}', {
      params: { path: { dialogue_id: currentId } },
      body: { text, character_id: characterId },
    });
    if (error || !data) return setError('Failed to save dialogue');
    setError(null);
    setDetail(data);
  }

  async function handleAdd(text: string, characterId: number | null) {
    if (sceneId == null) return;
    const { data, error } = await api.POST('/api/dialogues', {
      body: { scene_id: sceneId, parent_id: currentId, character_id: characterId, text },
    });
    if (error || !data) return setError('Failed to add dialogue');
    setError(null);
    setAdding(false);
    if (currentId == null) setCurrentId(data.id); // created this scene's first (root) node
    else await loadDialogue(currentId); // refresh so the new response shows in the wheel
  }

  const selectedScene = scenes.find((s) => s.id === sceneId) ?? null;
  const addLabel = currentId == null ? '＋ Add dialogue' : '＋ Add response';

  return (
    <div className="dialogue-editor">
      <ScenesSidebar scenes={scenes} selectedId={sceneId} onSelect={setSceneId} />

      <section className="dialogue-editor__stage">
        {selectedScene && (
          <div className="dialogue-editor__scene-title">
            {selectedScene.level_name} · {selectedScene.name}
          </div>
        )}

        {error && <p className="dialogue-editor__error">{error}</p>}

        {detail ? (
          <>
            <div className="dialogue-editor__parent">
              {detail.parent_id != null ? (
                <button
                  type="button"
                  className="dialogue-editor__back"
                  onClick={() => setCurrentId(detail.parent_id ?? null)}
                >
                  ▲ Back to parent
                </button>
              ) : (
                <span className="dialogue-editor__root-label">Root dialogue</span>
              )}
            </div>

            <DialogueBlob key={detail.id} detail={detail} characters={characters} onSave={handleEdit} />

            <ResponseWheel responses={detail.responses} onSelect={setCurrentId} />
          </>
        ) : (
          sceneId != null &&
          !error && (
            <p className="dialogue-editor__empty">This scene has no dialogue yet — add the first line.</p>
          )
        )}

        {sceneId != null && (
          <div className="dialogue-editor__add">
            {adding ? (
              <DialogueForm
                characters={characters}
                submitLabel={currentId == null ? 'Add dialogue' : 'Add response'}
                onSubmit={handleAdd}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button type="button" className="btn btn--add" onClick={() => setAdding(true)}>
                {addLabel}
              </button>
            )}
          </div>
        )}
      </section>

      <CharactersSidebar characters={characters} />
    </div>
  );
}
