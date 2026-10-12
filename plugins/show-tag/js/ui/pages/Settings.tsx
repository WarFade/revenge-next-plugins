import { DEFAULTS, type ShowTagStorage } from "../../index"
import { useChangelog } from "../../../../../shared/changelog"
import * as components from "@revenge-mod/components"
import { Design } from "@revenge-mod/discord/design"
import * as ReactNative from "react-native"

export default function Settings({
	api,
}: {
	api: RevengePluginStartApi<ShowTagStorage>
}) {
	// The changelog icon at the top right, and "What's new" once after an update.
	useChangelog()
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = components
	const { ScrollView } = ReactNative
	const { TableRowGroup, TableSwitchRow } = Design

	const { onlyUsername } = api.jsonStorage.use() ?? DEFAULTS

	return (
		<Page>
			<ScrollView>
				<TableRowGroup title="Display">
					<TableSwitchRow
						label="Only show usernames"
						subLabel="Replace the display name with the username instead of appending it."
						value={!!onlyUsername}
						onValueChange={value => api.jsonStorage.set({ onlyUsername: value })}
					/>
				</TableRowGroup>
			</ScrollView>
		</Page>
	)
}
