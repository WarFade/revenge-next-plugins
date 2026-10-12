/**
 * Free Stickers -- send any sticker without Nitro.
 *
 * Locked stickers become tappable in the picker; the ones Discord would refuse are sent as a link
 * to the sticker's image, which embeds as the picture. A setting sends every sticker that way,
 * even with Nitro. See `lib/patches.ts` for how, and for credits.
 */

import { DEFAULTS } from './defaults'
import { installPatches } from './lib/patches'
import { setStorage, TAG } from './lib/state'
import type { StickerStorage } from './types'
import Settings from './ui/Settings'
import { CHANGELOG } from './changelog'
import { setupChangelog } from '../../../shared/changelog'
import { reportError, setReporter } from '../../../shared/report'

export default plugin<{ jsonStorage: StickerStorage }>({
	jsonStorage: {
		load: true,
		default: DEFAULTS,
	},

	start({ cleanup, jsonStorage, plugin }) {
		// Errors go to Revenge's plugin error list (shared/report.ts), not the log.
		setReporter(plugin)
		cleanup(() => setReporter(undefined))

		if (plugin.startedLate) {
			plugin.requireReload()
			return
		}

		// The changelog: clock icon on the settings page, "What's new" after an update.
		cleanup(setupChangelog({ plugin, jsonStorage }, CHANGELOG))
		setStorage(jsonStorage)
		try {
			cleanup(installPatches())
		} catch (error) {
			reportError(`${TAG} failed to install:`, error)
		}
	},

	stop(api) {
		api.plugin.requireReload()
	},

	SettingsComponent: Settings,
})
