/**
 * Refusing replies and reactions on a message that no longer exists.
 *
 * ## Why they were ever possible
 *
 * A kept deletion is still an ordinary `state: 'SENT'` message to the rest of the client: the delete
 * was blocked (index.ts), so the message never left `MessageStore`. Messages restored after a reload
 * (`lib/restore.ts`) look the same. Reply and react are therefore offered exactly as they are on a
 * live message, and go out to an id the server deleted.
 *
 * ## Why this hooks the action creators and not the sheet
 *
 * The long-press sheet is only one of the ways in. Swipe-to-reply and double-tap-to-react never
 * open a sheet at all, and hiding rows would leave those two working. Every route ends at the
 * same small set of action creators, so blocking there covers all of them at once and cannot be
 * bypassed by a gesture we did not think of.
 *
 * ## Conservative by construction
 *
 * A hook only refuses when an argument is positively a known deletion (`isDeletedId`: kept this
 * session, or in the log). Anything else is passed straight through: the cost of a miss is the old
 * wrong behaviour on one message, while the cost of a false positive is a real reply the user
 * cannot send, which is much worse. Snowflakes are unique across channels, users, emoji and
 * messages, so a channel or emoji id can never be mistaken for a deleted message's.
 */

import type { GhostLogSettings } from '../types'
import { isDeletedId, isDeletedMessage } from '../lib/deleted'
import { showToast } from '../../../../shared/toast'

const TAG = '[GhostLogNativeBeta]'

/** Discord snowflakes, used to spot id arguments without knowing the parameter order. */
const SNOWFLAKE = /^\d{17,20}$/

function toast(content: string) {
	showToast(content, 'GhostLogDeletedMessageToast')
}

/**
 * Whether a call targets a deleted message, deduced from the arguments alone.
 *
 * Deliberately shape-driven rather than positional: these creators have been resorted between
 * Discord versions before, and a hook that silently stops matching is worse than one that reads
 * a little loosely. Objects are checked directly and one level in (`{ message }`, `{ messageId }`);
 * loose snowflakes are checked as message ids.
 *
 * It no longer asks `MessageStore.getMessage`: a message restored after a reload is not in the store,
 * so that lookup found nothing and reactions went out to deleted ids.
 */
export function targetsDeletedMessage(args: any[]): boolean {
	for (const arg of args ?? []) {
		if (typeof arg === 'string') {
			if (SNOWFLAKE.test(arg) && isDeletedId(arg)) return true
			continue
		}
		if (!arg || typeof arg !== 'object') continue
		if (isDeletedMessage(arg) || isDeletedMessage(arg.message)) return true
		const messageId = arg.messageId ?? arg.message_id
		if (typeof messageId === 'string' && isDeletedId(messageId)) return true
	}
	return false
}

/** The creators worth refusing, by the prop that identifies their module. */
const TARGETS: Array<{ prop: string; methods: string[]; notice: string }> = [
	{
		prop: 'createPendingReply',
		// Both entry points for a reply draft; the shallow one is what the swipe gesture uses.
		methods: ['createPendingReply', 'createShallowPendingReply'],
		notice: "That message was deleted — you can't reply to it.",
	},
	{
		prop: 'addReaction',
		// Only adding. Removing is left alone on purpose: if a reaction ever did land on a
		// flagged message, refusing to remove it would trap the user with it.
		methods: ['addReaction'],
		notice: "That message was deleted — you can't react to it.",
	},
]

function install(module: any, methods: string[], notice: string, cleanups: Array<() => void>) {
	const host = module?.default ?? module

	for (const method of methods) {
		if (typeof host?.[method] !== 'function') continue

		// `instead` because this has to be able to *not* call the original -- `before` can only
		// rewrite arguments. One `instead` per method and nothing else in this repo patches these,
		// so the two-`instead` recursion trap (porting rule 2) does not apply.
		cleanups.push(
			revenge.patcher.instead(host, method, (args: any[], original: any) => {
				try {
					if (targetsDeletedMessage(args)) {
						toast(notice)
						return undefined
					}
				} catch (error) {
					// Never let the guard itself break a real reply or reaction.
					console.error(`${TAG} ${method} guard failed:`, error)
				}

				return original(...args)
			}),
		)

		console.log(`${TAG} guarded ${method}`)
	}
}

/**
 * Sweep what is initialized, then subscribe for the rest.
 *
 * Not `lookupModule`: its misses are cached for the session and its budget is shared across every
 * caller in the app, so an early miss here is permanent and silent. Confirmed the hard way while
 * probing this build -- see [[revenge-next-getmodules-max-shared]].
 */
export default function patchBlockGhostActions(getSettings: () => GhostLogSettings): () => void {
	const cleanups: Array<() => void> = []
	const unsubscribes: Array<() => void> = []

	// Kept as a live read rather than a captured boolean: the guard is cheap, and reading per call
	// means turning the visual style off stops it without a reload, matching restore.ts.
	void getSettings

	try {
		const { lookupModules, waitForModules } = revenge.modules.finders
		const { withProps } = revenge.modules.finders.filters

		for (const target of TARGETS) {
			const seen = new Set<any>()
			const accept = (exports: any) => {
				const host = exports?.default ?? exports
				if (!host || seen.has(host)) return
				seen.add(host)
				install(exports, target.methods, target.notice, cleanups)
			}

			try {
				for (const [exports] of lookupModules(withProps(target.prop))) accept(exports)
				unsubscribes.push(waitForModules(withProps(target.prop), accept))
			} catch (error) {
				console.error(`${TAG} could not guard ${target.prop}:`, error)
			}
		}
	} catch (error) {
		console.error(`${TAG} action guards unavailable:`, error)
	}

	return () => {
		for (const unsubscribe of unsubscribes) {
			try { unsubscribe() } catch { /* already gone */ }
		}
		for (const unpatch of cleanups) {
			try { unpatch() } catch { /* already gone */ }
		}
		cleanups.length = 0
		unsubscribes.length = 0
	}
}
