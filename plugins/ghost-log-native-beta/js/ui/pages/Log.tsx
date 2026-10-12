import { confirmDestructive } from '../../../../../shared/ui/confirm'
import { savedMedia } from '../../lib/media'
import { jumpToDeletedMessage } from '../../lib/navigate'
import { ago, ChannelHeader, FilterBar, MessageCard } from '../components/Message'
import { dangerIcon } from '../icon'
import { Empty } from '../native'
import { useBottomPadding } from '../safeArea'
import { openDeletedSheet, pressMedia } from '../sheets'
import { clearNativeLog, type DeletedMessage, refreshLog, useLog } from '../state'
import * as components from '@revenge-mod/components'
import { Design } from '@revenge-mod/discord/design'
import * as react from '@revenge-mod/react'
import * as ReactNative from 'react-native'

type Filter = 'all' | 'servers' | 'dms' | 'media'

const FILTERS: Array<{ id: Filter; label: string }> = [
	{ id: 'all', label: 'All' },
	{ id: 'servers', label: 'Servers' },
	{ id: 'dms', label: 'DMs' },
	{ id: 'media', label: 'Media' },
]

type Row = { type: 'header'; key: string; entry: DeletedMessage } | { type: 'message'; key: string; entry: DeletedMessage }

function matches(entry: DeletedMessage, filter: Filter, query: string): boolean {
	if (filter === 'servers' && !entry.guildId) return false
	if (filter === 'dms' && entry.guildId) return false
	if (filter === 'media' && !savedMedia(entry).length && !entry.attachments?.length) return false
	if (!query) return true
	const haystack = [
		entry.content,
		entry.authorName,
		entry.channelName,
		entry.guildName,
		...(entry.attachments ?? []).map(attachment => attachment?.filename),
	]
	return haystack.some(text => typeof text === 'string' && text.toLowerCase().includes(query))
}

/** Newest first, with a channel header wherever the channel changes, like search results. */
function toRows(entries: DeletedMessage[]): Row[] {
	const rows: Row[] = []
	let channel: string | undefined
	for (const entry of entries) {
		if (entry.channelId !== channel) {
			channel = entry.channelId
			rows.push({ type: 'header', key: `h:${entry.id}`, entry })
		}
		rows.push({ type: 'message', key: entry.id, entry })
	}
	return rows
}

/**
 * Every caught deletion, drawn like Discord's search results: a channel header, then each message as
 * chat shows one, with its saved media. Tap jumps to where it was; long-press for the rest.
 */
export default function Log() {
	const { Page } = components
	const { React } = react
	const { FlatList, RefreshControl, View } = ReactNative as any
	const { TableRowGroup, TableRow, Text } = Design as any

	const entries = useLog()
	const bottomPadding = useBottomPadding()
	const [query, setQuery] = React.useState('')
	const [filter, setFilter] = React.useState<Filter>('all')
	const [refreshing, setRefreshing] = React.useState(false)

	const needle = query.trim().toLowerCase()
	const shown = React.useMemo(() => entries.filter(entry => matches(entry, filter, needle)), [entries, filter, needle])
	const rows = React.useMemo(() => toRows(shown), [shown])

	const refresh = () => {
		setRefreshing(true)
		void refreshLog().finally(() => setRefreshing(false))
	}

	const renderItem = ({ item }: { item: Row }) => {
		const entry = item.entry
		if (item.type === 'header') {
			return (
				<ChannelHeader
					guildId={entry.guildId}
					guildName={entry.guildName}
					guildIcon={entry.guildIcon}
					channelName={entry.channelName}
				/>
			)
		}
		const media = savedMedia(entry)
		const unsaved = (entry.attachments?.length ?? 0) - media.filter(m => m.key.includes(':a')).length
		return (
			<MessageCard
				authorId={entry.authorId}
				authorName={entry.authorName}
				authorAvatar={entry.authorAvatar}
				sentAt={entry.sentAt}
				content={entry.content}
				reply={
					entry.referencedMessage
						? {
								name: entry.referencedMessage.author?.global_name ?? entry.referencedMessage.author?.username,
								content: entry.referencedMessage.content,
							}
						: undefined
				}
				media={media}
				footerIcon="TrashIcon"
				footerDanger
				footer={`Deleted ${ago(entry.deletedAt)}${unsaved > 0 ? ` · ${unsaved} attachment${unsaved === 1 ? '' : 's'} not saved` : ''}`}
				onPress={() => jumpToDeletedMessage(entry)}
				onLongPress={() => openDeletedSheet(entry)}
				onPressMedia={index => pressMedia(media, index)}
			/>
		)
	}

	const header = (
		<FilterBar
			query={query}
			onQuery={setQuery}
			placeholder="Search deleted messages"
			filters={FILTERS}
			filter={filter}
			onFilter={setFilter}
		/>
	)

	const footer = entries.length ? (
		<View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 8 }}>
			<Text variant="text-xs/medium" color="text-muted" style={{ textAlign: 'center' }}>
				{shown.length === entries.length
					? `${entries.length} deleted message${entries.length === 1 ? '' : 's'}`
					: `${shown.length} of ${entries.length} deleted messages`}
			</Text>
			<TableRowGroup hasIcons>
				<TableRow
					variant="danger"
					label="Clear log"
					subLabel="Removes every deleted message and its saved media."
					icon={dangerIcon('TrashIcon', 'ic_trash')}
					onPress={() =>
						confirmDestructive({
							title: 'Clear log?',
							body: `All ${entries.length} deleted messages and their saved media are removed for good.`,
							action: 'Clear',
							onConfirm: () => void clearNativeLog(),
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
					entries.length ? (
						<Empty title="No matches" body="Nothing in the log matches that search." />
					) : (
						<Empty
							title="No deleted messages yet"
							body="When someone deletes a message Discord had loaded, it shows up here."
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
