import { callNativeMethod } from './native'
import * as metroModule from '@revenge-mod/modules/metro'
import { resolveMediaUri } from './richContent'
import type { DeletedMessage } from '../ui/state'
import * as finders from '@revenge-mod/discord/utils/modules/finders'
import * as modulesFinders from '@revenge-mod/modules/finders'
import * as filters from '@revenge-mod/modules/finders/filters'
import * as react from '@revenge-mod/react'
import { reportError } from '../../../../shared/report'

const DEBUG: boolean = false

const ID = 'bleelblep.ghost-log-native-beta'
const TAG = '[GhostLogNativeBeta]'

export type MediaKind = 'image' | 'video' | 'file'

/** One saved file from a deleted message: an attachment, or an embed's image or video. */
export interface SavedMedia {
	key: string
	entry: DeletedMessage
	/** The encrypted copy's name in native's media folder. */
	localFile: string
	kind: MediaKind
	filename: string
	size?: number
	width?: number
	height?: number
	contentType?: string
}

const VIDEO_EXT = /\.(mp4|mov|webm|mkv|m4v)$/i
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)$/i

function kindOf(contentType: unknown, name: string): MediaKind {
	const type = typeof contentType === 'string' ? contentType.toLowerCase() : ''
	if (type.startsWith('image/')) return 'image'
	if (type.startsWith('video/')) return 'video'
	if (VIDEO_EXT.test(name)) return 'video'
	if (IMAGE_EXT.test(name)) return 'image'
	return 'file'
}

function nameFrom(url: unknown, fallback: string): string {
	if (typeof url !== 'string' || url.startsWith('file://')) return fallback
	const last = url.split('?')[0].split('/').pop()
	return last ? decodeURIComponent(last) : fallback
}

/**
 * Every saved file of one deleted message, in the order Discord showed them. Anything without a
 * saved copy (over the size cap, or the download failed) is left out: its CDN link died with the
 * message. Embed author and footer icons are saved too, but they are not media anyone wants listed.
 */
export function savedMedia(entry: DeletedMessage): SavedMedia[] {
	const out: SavedMedia[] = []
	for (const [index, attachment] of (entry.attachments ?? []).entries()) {
		if (!attachment?.localFile) continue
		const filename = String(attachment.filename ?? nameFrom(attachment.remoteUrl, 'file'))
		out.push({
			key: `${entry.id}:a${index}`,
			entry,
			localFile: attachment.localFile,
			kind: kindOf(attachment.content_type, filename),
			filename,
			size: typeof attachment.size === 'number' ? attachment.size : undefined,
			width: attachment.width ?? undefined,
			height: attachment.height ?? undefined,
			contentType: attachment.content_type ?? undefined,
		})
	}
	for (const [index, embed] of (entry.embeds ?? []).entries()) {
		// A GIF link's embed has both: the video is the GIF, the thumbnail its first frame.
		const parts: Array<[any, MediaKind, string]> = embed?.video?.localFile
			? [[embed.video, 'video', 'v']]
			: [
					[embed?.image, 'image', 'i'],
					[embed?.thumbnail, 'image', 't'],
				]
		for (const [part, kind, slot] of parts) {
			if (!part?.localFile) continue
			out.push({
				key: `${entry.id}:e${index}${slot}`,
				entry,
				localFile: part.localFile,
				kind,
				filename: nameFrom(part.remoteUrl, kind === 'video' ? 'video' : 'image'),
				width: part.width ?? undefined,
				height: part.height ?? undefined,
			})
		}
	}
	return out
}

/** Every saved file across the log, newest deletion first. */
export function allSavedMedia(entries: DeletedMessage[]): SavedMedia[] {
	return entries.flatMap(savedMedia)
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const thumbs = new Map<string, string | null>()

/** A drawable picture for a saved file: the image itself, or a video's first frame. */
export async function previewUri(item: SavedMedia): Promise<string | undefined> {
	if (item.kind === 'image') return resolveMediaUri(item.localFile)
	if (item.kind !== 'video') return undefined
	if (thumbs.has(item.localFile)) return thumbs.get(item.localFile) ?? undefined
	try {
		const uri = await callNativeMethod(`${ID}.getMediaThumb`, [item.localFile])
		thumbs.set(item.localFile, typeof uri === 'string' && uri ? uri : null)
	} catch (error) {
		reportError(`${TAG} getMediaThumb failed:`, error)
		thumbs.set(item.localFile, null)
	}
	return thumbs.get(item.localFile) ?? undefined
}

/** React hook form of {@link previewUri}; undefined while loading or when there is none. */
export function usePreviewUri(item: SavedMedia): string | undefined {
	const { React } = react
	const [uri, setUri] = React.useState<string | undefined>()
	React.useEffect(() => {
		let live = true
		setUri(undefined)
		void previewUri(item).then(value => {
			if (live) setUri(value)
		})
		return () => {
			live = false
		}
	}, [item.localFile, item.kind])
	return uri
}

const MEDIA_VIEWER_PATH = 'modules/media_viewer/native/components/openMediaModal.tsx'

/** The viewer module's id on Discord 349.5 (349205): factory #7934 in the bundle, minus one. */
const KNOWN_VIEWER_IDS = [7933]

function metro(): any {
	return (metroModule as any)
}

/**
 * Whether module `id` is shaped like openMediaModal.tsx, judged from its imports alone, without
 * running it. On 349.5 it imports 15 modules, among them the three defined right after it (the
 * viewer screens it loads on first use) at positions 5, 7 and 8, and Discord's constants module at
 * position 3. A different build's ids are never run unless they match this.
 */
function looksLikeViewer(id: number, constants?: number): boolean {
	try {
		const deps = metro()?.getModuleDependencies?.(id)
		if (!Array.isArray(deps) || deps.length !== 15) return false
		if (deps[5] !== id + 1 || deps[7] !== id + 2 || deps[8] !== id + 3) return false
		return constants === undefined || deps[3] === constants
	} catch {
		return false
	}
}

function requireViewer(id: number): ((options: any) => void) | undefined {
	try {
		const exports = (globalThis as any).__r?.(id)
		if (typeof exports?.openMediaModal === 'function') {
			if (DEBUG) console.log(`${TAG} loaded Discord's media viewer (module ${id})`)
			return exports.openMediaModal
		}
	} catch (error) {
		reportError(`${TAG} loading module ${id} failed:`, error)
	}
	return undefined
}

let viewer: ((options: any) => void) | undefined

/**
 * Discord's `openMediaModal`. Discord loads it the first time something in chat opens media, and
 * an imported-path lookup only sees loaded modules, so from the log it was usually missing ("can't
 * open media" while chat worked). When it isn't loaded yet it is loaded here: by its known 349.5 id,
 * or else by searching for a module with its import pattern. The module only wires up its imports,
 * so loading it early has no side effects. Same approach as Sekai Stickers' upload modules.
 */
function openMediaModal(): ((options: any) => void) | undefined {
	if (viewer) return viewer
	try {
		const mod = (finders as any).lookupModuleWithImportedPath(MEDIA_VIEWER_PATH)?.[0]
		if (typeof mod?.openMediaModal === 'function') return (viewer = mod.openMediaModal)
	} catch {
		/* not loaded yet */
	}
	for (const id of KNOWN_VIEWER_IDS) {
		if (looksLikeViewer(id) && (viewer = requireViewer(id))) return viewer
	}
	// Another build: search, requiring the constants module too, so only one module can match.
	try {
		const { lookupModule } = modulesFinders
		const { withProps } = filters
		const constants = (lookupModule as any)(withProps('MEDIA_MODAL_KEY'))?.[1]
		if (typeof constants !== 'number') return undefined
		const matches: number[] = []
		for (let id = 0, misses = 0; misses < 2000; id++) {
			if (metro()?.getModuleDependencies?.(id) === undefined) {
				misses++
				continue
			}
			misses = 0
			if (looksLikeViewer(id, constants)) matches.push(id)
		}
		if (matches.length === 1) viewer = requireViewer(matches[0])
		else reportError(`${TAG} media viewer search found ${matches.length} candidates; not loading any`)
	} catch (error) {
		reportError(`${TAG} media viewer search failed:`, error)
	}
	return viewer
}

/** How many neighbours either side of the tapped item are opened with it, so a swipe has somewhere to go. */
const VIEWER_WINDOW = 8

/**
 * Opens saved images and videos in Discord's own media viewer, starting at `index`.
 *
 * The sources are built by hand in the shape Discord's `extractMediaFromAttachment` returns (349.5
 * bundle): `{ uri, width, height, mediaIndex, filename, ... }`, and for a video `videoURI` as well,
 * with `uri` as its poster. Discord's own extractor is not used: it rewrites CDN urls and applies
 * content-scan obscuring, neither of which means anything for a file:// path. Videos play through
 * LocalVideoHook, like they do in chat.
 *
 * Only a window around the tapped item is opened, because every source has to be decrypted first.
 * Returns true, or why it couldn't, for the toast.
 */
export async function openSavedMedia(items: SavedMedia[], index: number): Promise<true | string> {
	const open = openMediaModal()
	if (!open) {
		reportError(`${TAG} openMediaModal not found`)
		return "Discord's media viewer couldn't be loaded. Open any image in chat once, then try again."
	}
	const viewable = items.filter(item => item.kind !== 'file')
	const target = items[index]
	const at = Math.max(0, viewable.indexOf(target))
	const slice = viewable.slice(Math.max(0, at - VIEWER_WINDOW), at + VIEWER_WINDOW + 1)

	const sources: any[] = []
	let initialIndex = 0
	for (const item of slice) {
		const file = await resolveMediaUri(item.localFile)
		if (!file) continue
		if (item === target) initialIndex = sources.length
		const width = item.width || 1080
		const height = item.height || 1080
		const common = {
			mediaIndex: sources.length,
			messageId: item.entry.id,
			channelId: item.entry.channelId,
			guildId: item.entry.guildId,
			filename: item.filename,
			contentType: item.contentType,
			width,
			height,
		}
		if (item.kind === 'video') {
			const poster = await previewUri(item)
			sources.push({ ...common, uri: poster ?? file, sourceURI: file, videoURI: file })
		} else {
			sources.push({ ...common, uri: file, sourceURI: file })
		}
	}
	if (!sources.length) return "The saved copy couldn't be decrypted."

	try {
		open({
			initialSources: sources,
			initialIndex,
			analyticsSource: 'ghost_log',
			// Discord's share sheet forwards the CDN link, which is dead; saving to the gallery
			// copies the file and stays on.
			shareable: false,
			disableDownload: false,
		})
		return true
	} catch (error) {
		reportError(`${TAG} openMediaModal failed:`, error)
		return `Discord's media viewer failed: ${String((error as any)?.message ?? error)}`
	}
}
