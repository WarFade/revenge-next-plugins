import { setCreateMessageRecord } from './restore'
import { getEditRecord } from './edits'
import { isDeletedMessage, watchChannelMessages } from './deleted'
import type { GhostLogSettings } from '../types'

function stores() {
	return revenge.discord.flux.Stores as any
}

/**
 * A getModules callback runs from Revenge's own scheduler, outside every try/catch in this plugin.
 * Anything that throws in there -- a patcher assignment onto a read-only export, a module whose
 * shape changed in a new Discord build -- is an uncaught exception, which takes the whole app down
 * rather than just disabling a feature. Every callback goes through this.
 */
function guarded<A extends any[]>(label: string, fn: (...args: A) => void) {
	return (...args: A) => {
		try {
			fn(...args)
		} catch (error) {
			console.error(`[GhostLogNativeBeta] ${label} failed; feature disabled for this session:`, error)
		}
	}
}

/**
 * Mentioned users as full user objects. A MessageRecord keeps `mentions` as user id strings, but a
 * record rebuilt from the log (render-restore) goes through Discord's message builder, which adds
 * each mentioned user to its user store and its native user-search worker. That worker's parser
 * (`UserSearchTransformedUser`) requires an id and a username and throws a NullPointerException
 * that takes the app down otherwise (2026-10-03). Ids are resolved through UserStore; anything still
 * missing an id or username is dropped.
 */
export function mentionUsers(mentions: unknown): any[] {
	if (!Array.isArray(mentions)) return []
	const UserStore = stores().UserStore
	return mentions
		.map(m => (typeof m === 'string' ? UserStore?.getUser?.(m) : m))
		.filter(user => user?.id && user?.username)
}

/** Discord's EPHEMERAL message flag: "Only you can see this", removed locally when dismissed. */
const EPHEMERAL = 1 << 6

export function isEphemeral(message: any): boolean {
	return typeof message?.flags === 'number' && (message.flags & EPHEMERAL) !== 0
}

const clipVersion = (text: string) => {
	const flat = text.replace(/\s+/g, ' ').trim()
	if (!flat) return '(no text)'
	return flat.length > 300 ? `${flat.slice(0, 299)}…` : flat
}

/**
 * Earlier versions of an edited message, as muted `subtext` lines (Discord's `-#` small text)
 * above the current text, oldest first.
 *
 * `content` here is Discord's per-record parse cache (docs: discord-row-content-is-parse-cache), so
 * it is never changed in place: the row gets a new array that holds the cached nodes after ours.
 */
function applyEditHistory(ret: any, message: any, settings: GhostLogSettings) {
	if (!settings.showEditHistory || !message?.id) return
	const record = getEditRecord(String(message.id))
	if (!record?.versions?.length) return
	const content = ret?.message?.content
	if (!Array.isArray(content)) return
	const trail = record.versions.map(version => ({
		type: 'subtext',
		content: [{ type: 'text', content: clipVersion(version.content) }],
	}))
	ret.message.content = [...trail, ...content]
}

function patchRowManager(getSettings: () => GhostLogSettings, patches: (() => void)[]) {
	const { getModules } = revenge.modules.finders
	const { withName } = revenge.modules.finders.filters

	// `max` defaults to 1, and the count is spent even when the callback bails out early -- so the
	// plain call patched only the FIRST RowManager and stopped. There is more than one RowManager
	// class in this app (screenshot-redactor raises max for exactly this reason), which meant
	// deleted-message styling silently never applied wherever a second one rendered. Two module
	// entries can also resolve to the same class, so dedupe by prototype or the hooks install twice.
	const seenRowManagers = new Set<any>()

	const unsub = getModules(
		withName('RowManager'),
		guarded('RowManager patch', (RowManager: any) => {
			if (!RowManager?.prototype?.generate) {
				console.error('[GhostLogNativeBeta] RowManager.prototype.generate not found')
				return
			}
			if (seenRowManagers.has(RowManager.prototype)) return
			seenRowManagers.add(RowManager.prototype)

			// A stack, not one variable: after() gets no arguments, so the row is handed over from
			// before(). With a single slot, a generate() that ran another generate() inside it left the
			// outer call reading undefined (or the inner row).
			const pendingRows: any[] = []

			patches.push(
				revenge.patcher.before(RowManager.prototype, 'generate', (args: any[]) => {
					// A throwing original skips after() and leaves its entry behind. LIFO still pairs the
					// next call correctly; the cap only stops leftovers piling up.
					if (pendingRows.length > 32) pendingRows.splice(0, pendingRows.length - 32)
					pendingRows.push(args?.[0])
					return args
				}),
			)

			patches.push(
				revenge.patcher.after(RowManager.prototype, 'generate', (ret: any) => {
					const data = pendingRows.pop()

					try {
						if (data?.rowType !== 1) return ret
						const settings = getSettings()

						try {
							applyEditHistory(ret, data.message, settings)
						} catch (error) {
							console.error('[GhostLogNativeBeta] edit history row failed:', error)
						}

						if (settings.deleteStyle === 'off' || !isDeletedMessage(data?.message)) return ret

						if (settings.deleteStyle === 'overlay') {
							ret.message = ret.message ?? {}
							ret.message.edited = 'deleted'
							ret.backgroundHighlight = ret.backgroundHighlight ?? {}
							const { processColor } = revenge.react.ReactNative
							if (processColor) {
								ret.backgroundHighlight.backgroundColor = processColor('#da373c22')
								ret.backgroundHighlight.gutterColor = processColor('#da373cff')
							}
						} else if (settings.deleteStyle === 'text') {
							ret.message = ret.message ?? {}
							ret.message.edited = 'deleted'
							if (ret.message.colorString === undefined) {
								ret.message.colorString = '#f04747'
							}
						}
					} catch (error) {
						console.error('[GhostLogNativeBeta] RowManager hook failed:', error)
					}

					return ret
				}),
			)
		}),
		{ max: 10 },
	)

	return unsub
}

/**
 * Finds Discord's message record builder for render-restore, which needs real MessageRecords (methods,
 * Date timestamps) rather than plain objects that crash the row builder.
 *
 * Nothing here is patched any more. createMessageRecord and updateMessageRecord used to be hooked to
 * carry the deleted flag through the fake MESSAGE_UPDATE; with deletes blocked instead, there is no
 * fake update to carry it through, and two hooks on the hottest path in the chat are gone.
 */
function findMessageRecordBuilder() {
	const { getModules } = revenge.modules.finders
	const { withProps } = revenge.modules.finders.filters
	let found = false
	const unsub = getModules(
		withProps('createMessageRecord', 'updateMessageRecord'),
		guarded('createMessageRecord lookup', (mod: any) => {
			if (found) return
			const utils = typeof mod?.createMessageRecord === 'function' ? mod : mod?.default
			if (typeof utils?.createMessageRecord !== 'function') return
			found = true
			setCreateMessageRecord(utils.createMessageRecord)
		}),
		{ max: 10 },
	)
	return unsub
}

export function patchVisuals(getSettings: () => GhostLogSettings): () => void {
	// A module finder callback can land AFTER the plugin has been disabled -- the subscription is
	// asynchronous and the unsubscribes below only stop future matches, they cannot recall one that
	// is already running. Anything pushed after teardown used to sit in this array forever, leaving
	// a live hook on the chat render path belonging to a plugin the user had switched off. So the
	// array knows whether teardown has happened, and unpatches immediately if it has.
	let stopped = false
	const applied: (() => void)[] = []
	const patches = {
		push(unpatch: () => void) {
			if (stopped) {
				try { unpatch() } catch (e) { /* ignore */ }
				return
			}
			applied.push(unpatch)
		},
	} as unknown as (() => void)[]

	const unsubs: (() => void)[] = []
	for (const install of [
		() => patchRowManager(getSettings, patches),
		() => findMessageRecordBuilder(),
		() => watchChannelMessages(),
		// No hook on the MessageRecord class itself: once 0.5.0-beta14 made one install by wrapping
		// the constructor, message timestamps broke.
	]) {
		// One failing patch must not stop the others from installing, or skip cleanup for those
		// that did.
		try {
			unsubs.push(install())
		} catch (error) {
			console.error('[GhostLogNativeBeta] visual patch failed to install:', error)
		}
	}

	return () => {
		stopped = true
		for (const unpatch of applied) {
			try { unpatch() } catch (e) { /* ignore */ }
		}
		applied.length = 0
		for (const unsub of unsubs) {
			try { unsub() } catch (e) { /* ignore */ }
		}
		// Messages kept this session stay in the store until the reload that stop() asks for; there is
		// nothing to undo here. (0.6.x re-dispatched a delete for each one, which only existed to undo
		// its own fake updates.)
	}
}
