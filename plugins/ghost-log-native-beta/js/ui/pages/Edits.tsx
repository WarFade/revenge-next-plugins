import { confirmDestructive } from '../../../../../shared/ui/confirm'
import { clearEdits, type EditRecord, refreshEdits, useEdits } from '../../lib/edits'
import { jumpToDeletedMessage } from '../../lib/navigate'
import { ago, ChannelHeader, FilterBar, MessageCard } from '../components/Message'
import { dangerIcon } from '../icon'
import { Empty } from '../native'
import { useBottomPadding } from '../safeArea'
import { openEditSheet } from '../sheets'
import * as components from '@revenge-mod/components'
import { Design } from '@revenge-mod/discord/design'
import * as react from '@revenge-mod/react'
import * as ReactNative from 'react-native'

type Filter = 'all' | 'servers' | 'dms'

const FILTERS: Array<{ id: Filter; label: string }> = [
	{ id: 'all', label: 'All' },
	{ id: 'servers', label: 'Servers' },
	{ id: 'dms', label: 'DMs' },
]

type Row = { type: 'header'; key: string; record: EditRecord } | { type: 'message'; key: string; record: EditRecord }

function matches(record: EditRecord, filter: Filter, query: string): boolean {
	if (filter === 'servers' && !record.guildId) return false
	if (filter === 'dms' && record.guildId) return false
	if (!query) return true
	const haystack = [
		record.current,
		record.authorName,
		record.channelName,
		record.guildName,
		...record.versions.map(version => version.content),
	]
	return haystack.some(text => typeof text === 'string' && text.toLowerCase().includes(query))
}

function toRows(records: EditRecord[]): Row[] {
	const rows: Row[] = []
	let channel: string | undefined
	for (const record of records) {
		if (record.channelId !== channel) {
			channel = record.channelId
			rows.push({ type: 'header', key: `h:${record.id}`, record })
		}
		rows.push({ type: 'message', key: record.id, record })
	}
	return rows
}

/**
 * Every edited message caught, laid out like Deleted messages. Each shows its text as it is now,
 * with the version it replaced above it in muted text and the older ones behind "Show older".
 */
export default function Edits() {
	const { Page } = components
	const { React } = react
	const { FlatList, RefreshControl, View } = ReactNative as any
	const { TableRowGroup, TableRow, Text } = Design as any

	const records = useEdits()
	const bottomPadding = useBottomPadding()
	const [query, setQuery] = React.useState('')
	const [filter, setFilter] = React.useState<Filter>('all')
	const [refreshing, setRefreshing] = React.useState(false)

	const needle = query.trim().toLowerCase()
	const shown = React.useMemo(() => records.filter(record => matches(record, filter, needle)), [records, filter, needle])
	const rows = React.useMemo(() => toRows(shown), [shown])

	const refresh = () => {
		setRefreshing(true)
		void refreshEdits().finally(() => setRefreshing(false))
	}

	const renderItem = ({ item }: { item: Row }) => {
		const record = item.record
		if (item.type === 'header') {
			return (
				<ChannelHeader
					guildId={record.guildId}
					guildName={record.guildName}
					guildIcon={record.guildIcon}
					channelName={record.channelName}
				/>
			)
		}
		const count = record.versions.length
		return (
			<MessageCard
				authorId={record.authorId}
				authorName={record.authorName}
				authorAvatar={record.authorAvatar}
				sentAt={record.sentAt}
				content={record.current}
				// Newest first: the version this text replaced sits right above it.
				earlier={[...record.versions].reverse()}
				footerIcon="PencilIcon"
				footer={`Edited ${count} time${count === 1 ? '' : 's'} · last ${ago(record.editedAt)}`}
				onPress={() => jumpToDeletedMessage(record)}
				onLongPress={() => openEditSheet(record)}
			/>
		)
	}

	const header = (
		<FilterBar
			query={query}
			onQuery={setQuery}
			placeholder="Search edited messages"
			filters={FILTERS}
			filter={filter}
			onFilter={setFilter}
		/>
	)

	const footer = records.length ? (
		<View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 8 }}>
			<Text variant="text-xs/medium" color="text-muted" style={{ textAlign: 'center' }}>
				{shown.length === records.length
					? `${records.length} edited message${records.length === 1 ? '' : 's'}`
					: `${shown.length} of ${records.length} edited messages`}
			</Text>
			<TableRowGroup hasIcons>
				<TableRow
					variant="danger"
					label="Clear edit history"
					subLabel="Deleted messages are not affected."
					icon={dangerIcon('TrashIcon', 'ic_trash')}
					onPress={() =>
						confirmDestructive({
							title: 'Clear edit history?',
							body: `The earlier versions of all ${records.length} edited messages are removed for good.`,
							action: 'Clear',
							onConfirm: () => void clearEdits(),
						})
					}
				/>
			</TableRowGroup>
		</View>
	) : null

	return (
		<Page>
			<FlatList
				data={rows}
				keyExtractor={(row: Row) => row.key}
				renderItem={renderItem}
				ListHeaderComponent={header}
				ListFooterComponent={footer}
				ListEmptyComponent={
					records.length ? (
						<Empty title="No matches" body="Nothing in the edit history matches that search." />
					) : (
						<Empty
							title="No edited messages yet"
							body="When someone edits a message Discord had loaded, its earlier version is kept here."
						/>
					)
				}
				keyboardShouldPersistTaps="handled"
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
				contentContainerStyle={{ paddingBottom: bottomPadding }}
				initialNumToRender={12}
				windowSize={7}
			/>
		</Page>
	)
}
