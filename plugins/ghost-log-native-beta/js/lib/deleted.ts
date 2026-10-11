import { getModuleByPath } from '../../../../shared/modules'
import { isLoggedId } from '../ui/state'

/**
 * Which messages are deleted, and getting a kept one redrawn.
 *
 * ## How a deleted message stays on screen
 *
 * `MESSAGE_DELETE` is blocked before any store sees it (index.ts), so the message simply never
 * leaves `MessageStore`. Its id goes into `kept`, and everything that styles or guards a deleted
 * message asks `isDeletedMessage`, which answers from that set and the log.
 *
 * Up to 0.6.x the delete was rewritten into a fake `MESSAGE_UPDATE` carrying a `__vml_deleted`
 * property. That fake had to match a real update closely enough for Discord's native code, which
 * crashed the app when it didn't (mentions as id strings, 0.5.0-beta22), and the property lived
 * only on that one record, so any later rebuild of the message dropped the styling and the
 * reply/react guard with it. Blocking is what kmmiio's Message Tweaks does, and it is the mobile
 * equivalent of Vencord's MessageLogger, which leaves the deleted message in the store with a flag.
 *
 * `__vml_deleted` is still honoured: render-restore sets it on the records it builds.
 */

/** Messages kept on screen this session. Ids only; a snowflake is unique across channels. */
const kept = new Set<string>()

export function markKept(messageId: string) {
	kept.add(messageId)
}

/** Whether this message id is a known deletion: kept this session, or in the log. */
export function isDeletedId(messageId: string): boolean {
	return kept.has(messageId) || isLoggedId(messageId)
}

export function isDeletedMessage(message: any): boolean {
	if (!message || typeof message !== 'object') return false
	if (message.__vml_deleted === true) return true
	return typeof message.id === 'string' && isDeletedId(message.id)
}

// Discord's per-channel message cache (`lib/ChannelMessages.tsx`). Path first: Discord 349.5
// minifies names, and module paths survived it.
let channelMessages: any

export function watchChannelMessages(): () => void {
	const { withProps } = revenge.modules.finders.filters
	return getModuleByPath(
		'lib/ChannelMessages.tsx',
		withProps('getOrCreate', 'commit'),
		mod => {
			const cache = typeof mod?.getOrCreate === 'function' ? mod : mod?.default
			if (typeof cache?.getOrCreate === 'function' && typeof cache?.commit === 'function') channelMessages = cache
		},
		'[GhostLogNativeBeta]',
	)
}

const ZWSP = '​'

/**
 * Redraw one kept message so its row picks up the deleted styling.
 *
 * Blocking the delete changes nothing in the store, so Discord has no reason to redraw the row.
 * The record is swapped for a copy, and the row diff (`determineChangeType`) compares records by
 * value, so an identical copy is a no-op: the copy's text gets a zero-width space at the end. The
 * row is drawn from that same record, so the character stays invisible. This is Message Tweaks'
 * technique, which works on current builds.
 *
 * Best effort. If any of it is missing the message is still kept, and the styling appears the next
 * time Discord redraws the row (reopening the channel, for one).
 */
export function redrawKept(channelId: string, messageId: string): boolean {
	try {
		const cache = channelMessages
		if (!cache) return false
		const collection = cache.getOrCreate(channelId)
		if (typeof collection?.has !== 'function' || !collection.has(messageId)) return false
		if (typeof collection.update !== 'function') return false
		// update() is immutable: it returns a new collection, which has to be committed.
		const updated = collection.update(messageId, (message: any) => {
			try {
				if (message?.id !== messageId) return message
				// A same-prototype copy with the same fields. Records built through merge() or the
				// constructor come back missing array fields and crash the row builder.
				const copy = Object.create(Object.getPrototypeOf(message))
				Object.defineProperties(copy, Object.getOwnPropertyDescriptors(message))
				copy.__vml_deleted = true
				if (typeof copy.content === 'string' && !copy.content.endsWith(ZWSP)) copy.content = copy.content + ZWSP
				return copy
			} catch {
				return message
			}
		})
		cache.commit(updated)
		// After the current dispatch finishes: emitting from inside it re-enters React mid-render.
		queueMicrotask(() => {
			try {
				;(revenge.discord.flux.Stores as any).MessageStore?.emitChange?.()
			} catch (error) {
				console.error('[GhostLogNativeBeta] redraw emit failed:', error)
			}
		})
		return true
	} catch (error) {
		console.error('[GhostLogNativeBeta] redraw failed:', error)
		return false
	}
}
