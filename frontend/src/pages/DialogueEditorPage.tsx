import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Character,
  type DialogueDetail,
  type DialogueNode,
  type Scene,
} from '../api/client';
import { ScenesSidebar } from '../components/dialogue/ScenesSidebar';
import { CharactersSidebar } from '../components/dialogue/CharactersSidebar';
import { DialogueBlob } from '../components/dialogue/DialogueBlob';
import { DialogueForm } from '../components/dialogue/DialogueForm';
import { ResponseWheel } from '../components/dialogue/ResponseWheel';
import { DialogueTree } from '../components/dialogue/DialogueTree';
import '../components/dialogue/DialogueEditor.css';

type ViewMode = 'focus' | 'tree';

export default function DialogueEditorPage() {
  const { projectId, levelId } = useParams();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneId, setSceneId] = useState<number | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DialogueDetail | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('focus');
  const [treeNodes, setTreeNodes] = useState<DialogueNode[]>([]);

  // Characters power both the right sidebar and the form dropdowns (scoped to this project).
  useEffect(() => {
    const query = projectId ? { project_id: Number(projectId) } : undefined;
    api.GET('/api/characters', { params: { query } }).then(({ data }) => data && setCharacters(data));
  }, [projectId]);

  // Load this level's scenes and select the first one.
  useEffect(() => {
    api.GET('/api/scenes').then(({ data, error }) => {
      if (error || !data) return setError('Failed to load scenes');
      const levelScenes = levelId
        ? data.filter((s) => String(s.level_id) === levelId)
        : data;
      setError(null);
      setScenes(levelScenes);
      setSceneId(levelScenes[0]?.id ?? null);
    });
  }, [levelId]);

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

  // The whole scene's tree (flat) — powers the Tree view. Reloads when the scene changes.
  const loadTree = useCallback(() => {
    if (sceneId == null) return Promise.resolve();
    return api
      .GET('/api/scenes/{scene_id}/dialogues', { params: { path: { scene_id: sceneId } } })
      .then(({ data, error }) => {
        if (error || !data) return setError('Failed to load dialogue tree');
        setError(null);
        setTreeNodes(data);
      });
  }, [sceneId]);

  useEffect(() => {
    if (viewMode === 'tree') loadTree();
  }, [viewMode, loadTree]);

  async function handleEdit(text: string, characterId: number | null) {
    if (currentId == null) return;
    const { data, error } = await api.PATCH('/api/dialogues/{dialogue_id}', {
      params: { path: { dialogue_id: currentId } },
      body: { text, character_id: characterId },
    });
    if (error || !data) return setError('Failed to save dialogue');
    setError(null);
    setDetail(data);
    if (viewMode === 'tree') loadTree(); // keep the graph in sync
  }

  // Create a brand-new character (e.g. to write dialogue for someone not yet in the cast).
  async function createCharacter(name: string): Promise<Character | null> {
    if (!projectId) return null;
    const { data, error } = await api.POST('/api/characters', {
      body: { name, description: '', project_id: Number(projectId) },
    });
    if (error || !data) {
      setError('Failed to create character');
      return null;
    }
    setError(null);
    setCharacters((prev) => [...prev, data]);
    return data;
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
    if (viewMode === 'tree') loadTree(); // reflect the new node/edge in the graph
  }

  const selectedScene = scenes.find((s) => s.id === sceneId) ?? null;
  const addLabel = currentId == null ? '＋ Add dialogue' : '＋ Add response';

  return (
    <div className="dialogue-editor">
      <ScenesSidebar scenes={scenes} selectedId={sceneId} onSelect={setSceneId} />

      <section className="dialogue-editor__stage">
        <div className="dialogue-editor__crumb">
          <Link
            to={`/projects/${projectId}/levels/${levelId}`}
            className="dialogue-editor__back-link"
          >
            ← Level
          </Link>
        </div>

        {selectedScene && (
          <div className="dialogue-editor__scene-title">
            {selectedScene.level_name} · {selectedScene.name}
          </div>
        )}

        {sceneId != null && (
          <div className="dialogue-editor__viewtoggle">
            <button
              type="button"
              className={`dialogue-editor__viewbtn${viewMode === 'focus' ? ' is-active' : ''}`}
              onClick={() => setViewMode('focus')}
            >
              Focus
            </button>
            <button
              type="button"
              className={`dialogue-editor__viewbtn${viewMode === 'tree' ? ' is-active' : ''}`}
              onClick={() => setViewMode('tree')}
            >
              Tree
            </button>
          </div>
        )}

        {error && <p className="dialogue-editor__error">{error}</p>}

        {viewMode === 'tree' ? (
          <>
            {treeNodes.length > 0 ? (
              <DialogueTree nodes={treeNodes} selectedId={currentId} onSelect={setCurrentId} />
            ) : (
              sceneId != null &&
              !error && (
                <p className="dialogue-editor__empty">
                  This scene has no dialogue yet — add the first line.
                </p>
              )
            )}
            {detail && (
              <DialogueBlob
                key={detail.id}
                detail={detail}
                characters={characters}
                onSave={handleEdit}
                onCreateCharacter={createCharacter}
              />
            )}
          </>
        ) : detail ? (
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

            <DialogueBlob
              key={detail.id}
              detail={detail}
              characters={characters}
              onSave={handleEdit}
              onCreateCharacter={createCharacter}
            />

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
                onCreateCharacter={createCharacter}
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
