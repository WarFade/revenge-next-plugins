import { DEFAULTS } from '../defaults'
import type { AiHandle, VeilStorage } from '../types'
import { showToast } from '../../../../shared/toast'
import { Stores } from '@revenge-mod/discord/flux'
import { reportError } from '../../../../shared/report'

const DEBUG: boolean = false

export const TAG = '[Veil]'

type Storage = RevengeJsonStorageApi<VeilStorage>

let storage: Storage | undefined
let ai: AiHandle | undefined

export function setStorage(value: Storage) {
	storage = value
}

/** Sub-pages are plain navigator routes with no plugin `api` prop, so they read through this. */
export function getStorage(): Storage | undefined {
	return storage
}

/** Never reads `cache` without a fallback -- porting rule 7. */
export function settings(): VeilStorage {
	return { ...DEFAULTS, ...(storage?.cache ?? {}) }
}

export function patch(value: Partial<VeilStorage>) {
	try {
		storage?.set(value)
	} catch (error) {
		reportError(`${TAG} failed to write storage:`, error)
	}
}

/** Adds or removes one id in an id-list setting. Written whole, since `set()` replaces arrays. */
export function toggleId(
	key: 'channelIds' | 'userIds',
	id: string,
	on: boolean,
) {
	const list = settings()[key].filter(existing => existing !== id)
	if (on) list.push(id)
	patch({ [key]: list })
}

export function setAi(handle: AiHandle | undefined) {
	ai = handle
}

export function getAi(): AiHandle | undefined {
	return ai
}

export function debug(...args: unknown[]) {
	if (settings().debugLogging) { if (DEBUG) console.log(TAG, ...args) }
}

export function toast(content: string) {
	try {
		showToast(content, 'VeilToast')
	} catch {
		/* a missing toast is never worth a crash */
	}
}

export function currentUserId(): string | undefined {
	try {
		return (Stores as any)?.UserStore?.getCurrentUser?.()?.id
	} catch {
		return undefined
	}
}

export function channelName(id: string): string {
	try {
		const channel = (Stores as any)?.ChannelStore?.getChannel?.(id)
		return channel?.name ? `#${channel.name}` : id
	} catch {
		return id
	}
}

export function userName(id: string): string {
	try {
		const user = (Stores as any)?.UserStore?.getUser?.(id)
		return user?.globalName || user?.username || id
	} catch {
		return id
	}
}
