import { useChangelog } from '../../../../shared/changelog'
import { rowIcon } from '../../../../shared/ui/icon'
import * as components from '@revenge-mod/components'
import { Design } from '@revenge-mod/discord/design'
import * as ReactNative from 'react-native'

/** No options: this page exists for the changelog (clock icon, "What's new" after an update). */
export default function Settings() {
	useChangelog()
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = components
	const { ScrollView } = ReactNative
	const { Stack, TableRowGroup, TableRow } = Design as any

	return (
		<Page>
			<ScrollView>
				<Stack spacing={24}>
					<TableRowGroup hasIcons>
						<TableRow
							label="Nothing to set up"
							subLabel="The lines between rows are gone while the plugin is on. Turn it off to bring them back."
							icon={rowIcon('ListIcon', 'ic_list')}
						/>
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
