/**
 * Whose badges show: everyone, only the people on the show list, or everyone but the hide list.
 *
 * Both lists are kept whichever mode is on, so switching modes never loses one. A list maps a user
 * id to the name they had when added (shown in settings; Discord may not have the user cached
 * then); `null` is a removed entry's tombstone (porting rule 6).
 */

import { settings, update, type FilterMode } from './state'

function onList(list: Record<string, string | null> | undefined, userId: string): boolean {
	return typeof list?.[userId] === 'string'
}

/** Whether this author gets a badge under the current mode. */
export function shownFor(userId: string): boolean {
	const s = settings()
	if (s.filterMode === 'only') return onList(s.showList, userId)
	if (s.filterMode === 'except') return !onList(s.hideList, userId)
	return true
}

/** The list the current mode edits, or undefined for "everyone". */
export function activeList(mode: FilterMode = settings().filterMode): 'showList' | 'hideList' | undefined {
	return mode === 'only' ? 'showList' : mode === 'except' ? 'hideList' : undefined
}

export function isOnActiveList(userId: string): boolean {
	const key = activeList()
	return !!key && onList(settings()[key], userId)
}

/** Adds or removes [userId] on the list the current mode edits. */
export function setOnActiveList(userId: string, name: string, on: boolean) {
	const key = activeList()
	if (!key) return
	update({ [key]: { ...settings()[key], [userId]: on ? name : null } })
}

/** Removes [userId] from a specific list (the settings page lists both). */
export function removeFromList(key: 'showList' | 'hideList', userId: string) {
	update({ [key]: { ...settings()[key], [userId]: null } })
}

/** The live entries of a list, oldest first. */
export function entries(list: Record<string, string | null> | undefined): Array<{ id: string; name: string }> {
	return Object.entries(list ?? {})
		.filter((entry): entry is [string, string] => typeof entry[1] === 'string')
		.map(([id, name]) => ({ id, name }))
}
