/**
 * Discord's own pronouns, from the profile store.
 *
 * Pronouns are NOT on the UserRecord — they arrive with the profile, into
 * `modules/user_profile/UserProfileStore.tsx`. `getUserProfile(userId)?.pronouns` holds the user's
 * own; `getGuildMemberProfile(userId, guildId)?.pronouns` the guild-specific one, which wins when
 * it is set (the same precedence as DisplayProfile).
 *
 * Missing profiles are fetched with `fetchProfile(userId, { guildId })` from
 * `actions/UserActionCreators.tsx`, the call opening a profile makes. 0.2.0 and earlier used
 * `maybeFetchUserProfile(userId)`, which skips anyone whose user profile is already loaded and
 * never loads the guild member profile, so guild pronouns only appeared after opening the
 * profile (verified on 350.4, 2026-10-11). Fetches go one at a time, paced, and a failed one is
 * retried with backoff instead of being written off for the session.
 */

import { getModuleByPath } from '../../../../shared/modules'

const PROFILE_STORE = 'modules/user_profile/UserProfileStore.tsx'
const ACTIONS = 'actions/UserActionCreators.tsx'
const TAG = '[Pronouns]'

let store: any
let fetchProfile: ((userId: string, options?: { guildId?: string }) => unknown) | undefined

export function watchDiscord(): () => void {
	const undo: Array<() => void> = []
	let active = true
	let subscribed = false

	// Binds a store candidate (namespace, default, or the store itself) and subscribes to its
	// changes, so rows waiting on a profile redraw when one lands.
	const bind = (candidate: any) => {
		if (store || !candidate || typeof candidate.getUserProfile !== 'function') return false
		store = candidate
		const subscribe =
			typeof store.addChangeListener === 'function'
				? store.addChangeListener.bind(store)
				: typeof store.addListener === 'function'
				  ? store.addListener.bind(store)
				  : typeof store.subscribe === 'function'
				    ? store.subscribe.bind(store)
				    : undefined
		if (typeof subscribe === 'function' && !subscribed) {
			try {
				subscribe(() => {
					if (active) for (const listener of listeners) listener()
				})
				subscribed = true
			} catch (error) {
				console.error(`${TAG} profile store subscription failed:`, error)
			}
		}
		return true
	}

	// The flux Stores proxy answers from early on every build; on 350.4 the imported-path finder
	// alone never fired at startup, which made badges wait for the user to open a profile (the
	// only thing that initialised the module). The path finder stays as the fallback.
	try {
		bind((revenge as any).discord?.flux?.Stores?.UserProfileStore)
	} catch (error) {
		console.error(`${TAG} profile store lookup failed:`, error)
	}

	undo.push(
		getModuleByPath(PROFILE_STORE, null, (mod: any) => {
			if (!bind(mod) && !bind(mod?.default)) {
				console.error(`${TAG} profile store found but unusable`)
			}
		}, TAG),
	)
	const { withProps } = revenge.modules.finders.filters
	undo.push(
		getModuleByPath(ACTIONS, withProps('fetchProfile', 'fetchCurrentUser'), (mod: any) => {
			const fn = mod?.fetchProfile ?? mod?.default?.fetchProfile
			if (typeof fn === 'function') {
				fetchProfile = fn
				pump()
			}
		}, TAG),
	)

	return () => {
		active = false
		for (const fn of undo.reverse()) {
			try {
				fn()
			} catch {
				/* already gone */
			}
		}
		store = undefined
		fetchProfile = undefined
		resetQueue()
	}
}

const listeners = new Set<() => void>()

/** Fires when a profile may have landed, for redrawing rows that were waiting on one. */
export function onProfileChange(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

/** The first non-empty pronouns value: guild profile first, then the user's own. */
export function discordPronouns(userId: string, guildId?: string): string | undefined {
	try {
		if (!store) return undefined
		const guild = guildId ? store.getGuildMemberProfile?.(userId, guildId)?.pronouns : undefined
		const own = store.getUserProfile?.(userId)?.pronouns
		const value = typeof guild === 'string' && guild.trim() ? guild : typeof own === 'string' ? own : undefined
		return typeof value === 'string' && value.trim() ? value.trim() : undefined
	} catch {
		return undefined
	}
}

/** Whether the store already holds what the badge needs: the guild member profile in a guild. */
function loaded(userId: string, guildId?: string): boolean {
	try {
		if (guildId) return !!store?.getGuildMemberProfile?.(userId, guildId)
		return !!store?.getUserProfile?.(userId)
	} catch {
		return false
	}
}

// ---- The fetch queue ---------------------------------------------------------------------------

/** Spacing between profile requests: a busy channel shouldn't trip Discord's rate limit. */
const GAP_MS = 300
const MAX_TRIES = 4
const RETRY_MS = [5_000, 30_000, 120_000]

/** `userId:guildId` → its attempt state. `done` keys are never fetched again this session. */
const jobs = new Map<string, { userId: string; guildId?: string; tries: number; notBefore: number; done: boolean }>()
let busy = false
let timer: ReturnType<typeof setTimeout> | undefined

function resetQueue() {
	jobs.clear()
	busy = false
	if (timer !== undefined) clearTimeout(timer)
	timer = undefined
}

function schedule(delay: number) {
	if (timer !== undefined) return
	timer = setTimeout(() => {
		timer = undefined
		pump()
	}, delay)
}

/** Runs the next due fetch; one in flight at a time. */
function pump() {
	if (busy || typeof fetchProfile !== 'function') return
	const now = Date.now()
	let next: ReturnType<typeof jobs.get>
	let soonest = Number.POSITIVE_INFINITY
	for (const job of jobs.values()) {
		if (job.done) continue
		if (loaded(job.userId, job.guildId)) {
			// Landed some other way (someone opened the profile).
			job.done = true
			continue
		}
		if (job.notBefore <= now) {
			next = job
			break
		}
		soonest = Math.min(soonest, job.notBefore)
	}
	if (!next) {
		if (soonest !== Number.POSITIVE_INFINITY) schedule(soonest - now)
		return
	}
	const job = next
	busy = true
	job.tries++
	const finish = (ok: boolean, retryAfterMs?: number) => {
		busy = false
		if (ok || loaded(job.userId, job.guildId) || job.tries >= MAX_TRIES) {
			job.done = true
		} else {
			job.notBefore = Date.now() + Math.max(retryAfterMs ?? 0, RETRY_MS[job.tries - 1] ?? RETRY_MS[RETRY_MS.length - 1])
		}
		schedule(GAP_MS)
	}
	try {
		const result: any = fetchProfile(job.userId, job.guildId ? { guildId: job.guildId } : undefined)
		if (result && typeof result.then === 'function') {
			result.then(
				() => finish(true),
				(error: any) => {
					// A 429 carries Discord's own wait in seconds.
					const retryAfter = Number(error?.body?.retry_after)
					finish(false, Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined)
				},
			)
		} else {
			finish(true)
		}
	} catch (error) {
		console.error(`${TAG} profile fetch failed:`, error)
		finish(false)
	}
}

/**
 * Queues a profile fetch when the store lacks what the badge needs: the guild member profile in a
 * guild (it can carry its own pronouns, and fetching it brings the user profile too), else the
 * user profile. Cheap to call on every render; each user/guild pair is fetched at most once per
 * session unless it fails, in which case it is retried with backoff.
 */
export function fetchOnMiss(userId: string, guildId?: string) {
	const key = `${userId}:${guildId ?? ''}`
	if (jobs.has(key) || loaded(userId, guildId)) return
	jobs.set(key, { userId, guildId, tries: 0, notBefore: 0, done: false })
	schedule(0)
}
