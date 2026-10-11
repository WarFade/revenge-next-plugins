/** Settings and per-user overrides, in the plugin's jsonStorage. */

/** Whose badges show; see lib/filter.ts. */
export type FilterMode = 'everyone' | 'only' | 'except'

export interface PronounsStorage {
	/** The tag next to author names in chat. */
	showInChat: boolean
	/** Discord's own pronouns before PronounDB. Off asks PronounDB first. */
	discordFirst: boolean
	/**
	 * Pronouns you set yourself, per user id. A `null` value is a cleared override, kept as a
	 * tombstone so a merge can't bring it back (porting rule 6).
	 */
	overrides: Record<string, string | null>
	/** Everyone, only [showList], or everyone except [hideList]. */
	filterMode: FilterMode
	/** User id → name when added; `null` is a removed entry's tombstone. Used by "only". */
	showList: Record<string, string | null>
	/** User id → name when added; `null` is a removed entry's tombstone. Used by "except". */
	hideList: Record<string, string | null>
}

export const DEFAULTS: PronounsStorage = {
	showInChat: true,
	discordFirst: true,
	overrides: {},
	filterMode: 'everyone',
	showList: {},
	hideList: {},
}

let storage: RevengeJsonStorageApi<PronounsStorage> | undefined
const listeners = new Set<() => void>()

export function setStorage(handle: RevengeJsonStorageApi<PronounsStorage> | undefined) {
	storage = handle
}

/** Read at any time; falls back to the defaults while storage loads. */
export function settings(): PronounsStorage {
	return { ...DEFAULTS, ...((storage as any)?.cache ?? {}) }
}

/** The saved settings, re-rendering on change. Call like a hook. */
export function useSettings(): PronounsStorage {
	return { ...DEFAULTS, ...(storage?.use() ?? {}) }
}

export function update(patch: Partial<PronounsStorage>) {
	storage?.set(patch)
	for (const listener of listeners) listener()
}

/** Runs [fn] after every update() from this plugin. */
export function onUpdate(fn: () => void): () => void {
	listeners.add(fn)
	return () => listeners.delete(fn)
}
