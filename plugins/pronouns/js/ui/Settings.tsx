import { useChangelog } from '../../../../shared/changelog'
import { rowIcon } from '../../../../shared/ui/icon'
import { useBottomPadding } from '../../../../shared/ui/safeArea'
import { entries, removeFromList } from '../lib/filter'
import { update, useSettings, type FilterMode } from '../lib/state'
import * as components from '@revenge-mod/components'
import { Design } from '@revenge-mod/discord/design'
import * as ReactNative from 'react-native'

const LISTS = {
	only: {
		key: 'showList',
		title: 'Showing pronouns for',
		empty: 'No one yet',
		hint: 'Long-press a message from someone and choose Show their pronouns.',
	},
	except: {
		key: 'hideList',
		title: 'Hiding pronouns for',
		empty: 'No one yet',
		hint: 'Long-press a message from someone and choose Hide their pronouns.',
	},
} as const

export default function Settings() {
	// The changelog icon at the top right, and "What's new" once after an update.
	useChangelog()
	const { Page } = components
	const { ScrollView } = ReactNative
	const { Stack, TableRowGroup, TableRow, TableSwitchRow, TableRadioGroup, TableRadioRow } = Design as any
	const s = useSettings()
	const list = s.filterMode === 'only' || s.filterMode === 'except' ? LISTS[s.filterMode] : undefined
	const people = list ? entries(s[list.key]) : []

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<TableRowGroup title="Badges" hasIcons>
						<TableSwitchRow
							label="Show in chat"
							subLabel="A small tag with a person's pronouns next to their name on messages."
							icon={rowIcon('UserCircleIcon', 'CompassIcon')}
							value={s.showInChat}
							onValueChange={(showInChat: boolean) => update({ showInChat })}
						/>
						<TableSwitchRow
							label="Discord pronouns first"
							subLabel="Off asks PronounDB before the person's own Discord profile."
							icon={rowIcon('PencilIcon', 'CompassIcon')}
							value={s.discordFirst}
							onValueChange={(discordFirst: boolean) => update({ discordFirst })}
						/>
					</TableRowGroup>

					<TableRadioGroup
						key={`filterMode-${s.filterMode}`}
						title="Whose pronouns show"
						description="Each list is kept when you switch, so you can go back to it."
						defaultValue={s.filterMode}
						onChange={(filterMode: FilterMode) => update({ filterMode })}
					>
						<TableRadioRow label="Everyone" value="everyone" />
						<TableRadioRow label="Only people I pick" value="only" />
						<TableRadioRow label="Everyone except people I hide" value="except" />
					</TableRadioGroup>

					{list && (
						<TableRowGroup title={list.title} hasIcons>
							{people.length === 0 ? (
								<TableRow label={list.empty} subLabel={list.hint} icon={rowIcon('UserCircleIcon', 'CompassIcon')} />
							) : (
								people.map(person => (
									<TableRow
										key={person.id}
										label={person.name}
										subLabel="Tap to remove"
										icon={rowIcon('UserCircleIcon', 'CompassIcon')}
										onPress={() => removeFromList(list.key, person.id)}
									/>
								))
							)}
						</TableRowGroup>
					)}
				</Stack>
			</ScrollView>
		</Page>
	)
}
