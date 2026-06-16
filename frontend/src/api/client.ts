import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

/**
 * Typed API client generated from the Django Ninja OpenAPI schema.
 * Regenerate the schema with `npm run gen:api` (backend must be running).
 */
export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
});

// Re-export the backend's schemas as usable TS objects.
export type Character = components['schemas']['CharacterOut'];
export type Scene = components['schemas']['SceneOut'];
export type DialogueSummary = components['schemas']['DialogueSummaryOut'];
export type DialogueDetail = components['schemas']['DialogueDetailOut'];
export type User = components['schemas']['UserOut'];

// Available UI themes (must match the backend User.THEME_CHOICES).
export const THEMES = ['neon', 'aqua', 'light'] as const;
export type Theme = (typeof THEMES)[number];
