/**
 * One lookup for a badge: your override first, then Discord's own pronouns and PronounDB in the
 * order the settings choose. Everything here answers synchronously; asynchronous sources (a
 * profile fetch, a PronounDB batch) are *primed* here and land through the listeners the patches
 * subscribe to.
 */

import { cached, request } from './pronounDB'
import { discordPronouns, fetchOnMiss } from './discord'
import { settings } from './state'

export interface Resolved {
	text: string
	source: 'override' | 'discord' | 'pronoundb'
}

export function overrideFor(userId: string): string | undefined {
	const value = settings().overrides?.[userId]
	// null is a cleared override's tombstone, not a value.
	return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** The pronoun string the badge shows for this author, if any is known right now. */
export function resolve(userId: string, guildId?: string): Resolved | undefined {
	try {
		const override = overrideFor(userId)
		if (override) return { text: override, source: 'override' }
		const s = settings()
		const discord = discordPronouns(userId, guildId)
		const db = cached(userId)
		if (s.discordFirst) {
			if (discord) return { text: discord, source: 'discord' }
			if (db) return { text: db, source: 'pronoundb' }
		} else {
			if (db) return { text: db, source: 'pronoundb' }
			if (discord) return { text: discord, source: 'discord' }
		}
		return undefined
	} catch {
		return undefined
	}
}

/**
 * Kicks off whatever is missing for this author: a Discord profile fetch when the store has
 * nothing, and a PronounDB lookup when it isn't cached. Deduped by both clients.
 */
export function prime(userId: string, guildId?: string) {
	if (overrideFor(userId)) return
	// Even with the user's own pronouns known: a guild profile can carry its own, which win.
	fetchOnMiss(userId, guildId)
	if (!cached(userId)) request(userId)
}
