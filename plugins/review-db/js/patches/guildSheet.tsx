/*
 * "Server Reviews" in the server long-press sheet. Desktop adds "View Reviews" to the guild
 * context menus (src/plugins/reviewDB/index.tsx, `guildPopoutPatch`).
 * Copyright (c) 2023 Vendicated and contributors. GPL-3.0-or-later; see ../../NOTICE.md.
 *
 * `GuildActionSheet` renders `GuildActionSheetActions.GuildActionSheetSecondaryActions({ guild })`
 * off the module namespace at render time, so a hook on that export adds a group of our own after
 * it. Same `before` stash / `after` pair as patches/profileCard.tsx.
 */

import { TAG } from '../lib/discord'
import { ReviewType } from '../lib/entities'
import { openReviews } from '../ui/routes'
import { getAssetIdByName } from '@revenge-mod/assets'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import * as modulesFinders from '@revenge-mod/discord/utils/modules/finders'
import * as finders from '@revenge-mod/modules/finders'
import * as filters from '@revenge-mod/modules/finders/filters'
import { after, before } from '@revenge-mod/patcher'
import { reportError } from '../../../../shared/report'

const DEBUG: boolean = false

const PATH = 'modules/guild_action_sheet/native/components/GuildActionSheetActions.tsx'
const TARGET = 'GuildActionSheetSecondaryActions'

let actionSheetRow: any
function ActionSheetRowComponent() {
	if (!actionSheetRow) {
		const { lookupModule } = finders
		const { withProps } = filters
		actionSheetRow = lookupModule<any>(withProps('ActionSheetRow'))?.[0]?.ActionSheetRow
	}
	return actionSheetRow
}

function hideActionSheet() {
	try {
		ActionSheetActionCreators.hideActionSheet()
	} catch {
		/* the sheet stays open; harmless */
	}
}

function ServerReviewsGroup({ guild }: { guild: { id: string; name: string } }) {
	const ActionSheetRow = ActionSheetRowComponent()
	if (!ActionSheetRow) return null
	return (
		<ActionSheetRow.Group>
			<ActionSheetRow
				label="Server Reviews"
				icon={<ActionSheetRow.Icon source={getAssetIdByName('StarIcon')} />}
				onPress={() => {
					hideActionSheet()
					openReviews(guild.id, guild.name, ReviewType.Server)
				}}
			/>
		</ActionSheetRow.Group>
	)
}

export default function patchGuildSheet(): () => void {
	const patches: Array<() => void> = []
	let lastProps: any
	let unsubscribe: (() => void) | undefined

	const apply = (mod: any) => {
		try {
			if (typeof mod?.[TARGET] !== 'function') {
				reportError(`${TAG} ${TARGET} not found on ${PATH}; the server sheet row is off.`)
				return
			}
			patches.push(
				before(mod, TARGET, (args: any[]) => {
					lastProps = args?.[0]
					return args
				}),
				after(mod, TARGET, (ret: any) => {
					const guild = lastProps?.guild
					lastProps = undefined
					if (typeof guild?.id !== 'string') return ret
					return (
						<>
							{ret}
							<ServerReviewsGroup guild={guild} />
						</>
					)
				}),
			)
			if (DEBUG) console.log(`${TAG} hooked ${TARGET}`)
		} catch (error) {
			reportError(`${TAG} failed to hook the server sheet:`, error)
		}
	}

	try {
		unsubscribe = (modulesFinders as any).getModuleWithImportedPath(PATH, apply)
	} catch (error) {
		reportError(`${TAG} server sheet lookup failed:`, error)
	}

	return () => {
		unsubscribe?.()
		for (const unpatch of patches) unpatch()
		patches.length = 0
	}
}
