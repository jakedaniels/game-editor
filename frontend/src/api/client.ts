import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

/**
 * Typed API client generated from the Django Ninja OpenAPI schema.
 * Regenerate the schema with `npm run gen:api` (backend must be running).
 */
/** Base URL of the backend API — also used for direct `fetch` calls (e.g. multipart uploads). */
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const api = createClient<paths>({ baseUrl: API_BASE });

// Re-export the backend's schemas as usable TS objects.
export type Character = components['schemas']['CharacterOut'];
export type CharacterDetail = components['schemas']['CharacterDetailOut'];
export type RelatedCharacter = components['schemas']['RelatedCharacterOut'];
export type LevelCharacter = components['schemas']['LevelCharacterOut'];
export type Project = components['schemas']['ProjectOut'];
export type Level = components['schemas']['LevelOut'];
export type Scene = components['schemas']['SceneOut'];
export type DialogueSummary = components['schemas']['DialogueSummaryOut'];
export type DialogueDetail = components['schemas']['DialogueDetailOut'];
export type DialogueNode = components['schemas']['DialogueNodeOut'];
export type User = components['schemas']['UserOut'];

// Available UI themes (must match the backend User.THEME_CHOICES).
export const THEMES = ['neon', 'aqua', 'light', 'studio'] as const;
export type Theme = (typeof THEMES)[number];
