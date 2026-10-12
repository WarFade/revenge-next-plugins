/**
 * The pieces the log screens are built from, laid out like Discord's own search results: a channel
 * header, then messages drawn the way chat draws them (avatar, name line, text, media). Chat rows
 * themselves are drawn natively and cannot be reused, so this follows their look with Discord's
 * Text, Avatar, BotTag and icons, like ReviewDB's review rows.
 */

import { type SavedMedia, usePreviewUri } from '../../lib/media'
import { BotTag, Glyph, GuildIcon, UserAvatar } from '../native'
import { token } from '../theme'
import { Design } from '@revenge-mod/discord/design'
import { Stores } from '@revenge-mod/discord/flux'
import * as react from '@revenge-mod/react'
import * as ReactNative from 'react-native'

export function ago(timestamp: number): string {
	const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
	if (seconds < 60) return 'just now'
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
	return `${Math.floor(seconds / 86400)}d ago`
}

/** "Today at 14:02", "Yesterday at 22:10", or the date, the way chat stamps a message. */
export function stamp(timestamp: number): string {
	const date = new Date(timestamp)
	if (Number.isNaN(date.getTime())) return ''
	const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
	const now = new Date()
	if (date.toDateString() === now.toDateString()) return `Today at ${time}`
	const yesterday = new Date(now)
	yesterday.setDate(now.getDate() - 1)
	if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`
	return `${date.toLocaleDateString()} ${time}`
}

function isBot(userId: string): boolean {
	try {
		return !!(Stores as any).UserStore?.getUser?.(userId)?.bot
	} catch {
		return false
	}
}

/** "Server › #channel" above each run of messages from one channel, like search results. */
export function ChannelHeader({
	guildId,
	guildName,
	guildIcon,
	channelName,
}: {
	guildId?: string
	guildName?: string
	guildIcon?: string
	channelName: string
}) {
	const { View } = ReactNative
	const { Text } = Design as any
	const where = guildId ? guildName ?? 'Server' : 'Direct messages'
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 8,
				paddingHorizontal: 16,
				paddingTop: 20,
				paddingBottom: 4,
			}}
		>
			{guildId ? <GuildIcon id={guildId} hash={guildIcon} name={where} size={18} /> : null}
			<Text variant="text-sm/semibold" color="text-muted" lineClamp={1} style={{ flexShrink: 1 }}>
				{guildId ? `${where}  ›  ${channelName}` : `${where}  ›  ${channelName === 'Direct message' ? 'DM' : channelName}`}
			</Text>
		</View>
	)
}

/** One saved image or video as a square, or a file as its name. */
export function MediaTile({
	item,
	size,
	onPress,
	onLongPress,
}: {
	item: SavedMedia
	size: number
	onPress?: () => void
	onLongPress?: () => void
}) {
	const { View, Image, Pressable } = ReactNative
	const { Text } = Design as any
	const uri = usePreviewUri(item)
	const surface = token('BACKGROUND_MOD_SUBTLE', '#2e3035')
	const muted = token('TEXT_MUTED', '#949ba4')
	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			delayLongPress={350}
			accessibilityRole="imagebutton"
			accessibilityLabel={item.filename}
			style={({ pressed }: { pressed: boolean }) => ({
				width: size,
				height: size,
				borderRadius: 8,
				overflow: 'hidden',
				backgroundColor: surface,
				opacity: pressed ? 0.7 : 1,
			})}
		>
			{uri ? (
				<Image source={{ uri }} resizeMode="cover" resizeMethod="resize" style={{ width: size, height: size }} />
			) : item.kind === 'file' ? (
				<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 6 }}>
					<Glyph name="FileIcon" color={muted} size={24} />
					<Text variant="text-xs/medium" color="text-muted" lineClamp={2} style={{ textAlign: 'center' }}>
						{item.filename}
					</Text>
				</View>
			) : null}
			{item.kind === 'video' ? (
				<View
					pointerEvents="none"
					style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
				>
					<View
						style={{
							width: 36,
							height: 36,
							borderRadius: 18,
							backgroundColor: 'rgba(0,0,0,0.55)',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Glyph name="PlayIcon" color="#ffffff" size={16} />
					</View>
				</View>
			) : null}
		</Pressable>
	)
}

export interface EarlierVersion {
	content: string
	editedAt: number
}

/**
 * One logged message, drawn like a chat message. `footer` says what happened to it (deleted, edited)
 * with its icon. Edited messages pass their earlier versions, newest first; the latest shows, the
 * rest behind "Show more".
 */
export function MessageCard({
	authorId,
	authorName,
	authorAvatar,
	sentAt,
	content,
	reply,
	media,
	earlier,
	footerIcon,
	footer,
	footerDanger,
	onPress,
	onLongPress,
	onPressMedia,
}: {
	authorId: string
	authorName: string
	authorAvatar?: string
	sentAt?: number
	content: string
	reply?: { name?: string; content?: string }
	media?: SavedMedia[]
	earlier?: EarlierVersion[]
	footerIcon: string
	footer: string
	footerDanger?: boolean
	onPress?: () => void
	onLongPress?: () => void
	onPressMedia?: (index: number) => void
}) {
	const { React } = react
	const { View, Pressable } = ReactNative
	const { Text } = Design as any
	const [expanded, setExpanded] = React.useState(false)
	const [allVersions, setAllVersions] = React.useState(false)
	const muted = token('TEXT_MUTED', '#949ba4')
	const long = content.length > 400
	const versions = earlier ?? []
	const shownVersions = allVersions ? versions : versions.slice(0, 1)

	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			delayLongPress={350}
			android_ripple={{ color: token('BACKGROUND_MOD_SUBTLE', '#2e3035') }}
			style={{ paddingHorizontal: 16, paddingVertical: 8 }}
		>
			{reply?.name || reply?.content ? (
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 20, marginBottom: 4 }}>
					<Glyph name="ArrowAngleLeftUpIcon" color={muted} size={12} />
					<Text variant="text-sm/normal" color="text-muted" lineClamp={1} style={{ flexShrink: 1 }}>
						{reply.name ? (
							<Text variant="text-sm/semibold" color="text-muted">
								{`@${reply.name} `}
							</Text>
						) : null}
						{reply.content || 'Click to see attachment'}
					</Text>
				</View>
			) : null}

			<View style={{ flexDirection: 'row', gap: 12 }}>
				<UserAvatar userId={authorId} hash={authorAvatar} />
				<View style={{ flex: 1, gap: 2 }}>
					<View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6 }}>
						<Text variant="text-md/semibold" color="text-strong" lineClamp={1}>
							{authorName}
						</Text>
						{isBot(authorId) ? <BotTag /> : null}
						{sentAt ? (
							<Text variant="text-xs/medium" color="text-muted">
								{stamp(sentAt)}
							</Text>
						) : null}
					</View>

					{shownVersions.map((version, index) => (
						<Text key={index} variant="text-sm/normal" color="text-muted" lineClamp={allVersions ? undefined : 3}>
							{version.content.trim() || '(no text)'}
						</Text>
					))}
					{versions.length > 1 ? (
						<Text
							variant="text-xs/semibold"
							style={{ color: token('TEXT_LINK', '#00a8fc') }}
							onPress={() => setAllVersions(!allVersions)}
						>
							{allVersions ? 'Show less' : `Show ${versions.length - 1} older version${versions.length === 2 ? '' : 's'}`}
						</Text>
					) : null}

					{content ? (
						<Text variant="text-md/normal" color="text-default">
							{long && !expanded ? `${content.slice(0, 400).trimEnd()}… ` : content}
							{long && !expanded ? (
								<Text
									variant="text-md/medium"
									style={{ color: token('TEXT_LINK', '#00a8fc') }}
									onPress={() => setExpanded(true)}
								>
									Read more
								</Text>
							) : null}
						</Text>
					) : null}

					{media?.length ? (
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
							{media.slice(0, 4).map((item, index) => (
								<MediaTile key={item.key} item={item} size={96} onPress={() => onPressMedia?.(index)} />
							))}
							{media.length > 4 ? (
								<View style={{ height: 96, justifyContent: 'center', paddingHorizontal: 8 }}>
									<Text variant="text-sm/semibold" color="text-muted">{`+${media.length - 4}`}</Text>
								</View>
							) : null}
						</View>
					) : null}

					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
						<Glyph
							name={footerIcon}
							color={footerDanger ? token('TEXT_FEEDBACK_CRITICAL', '#f57976') : muted}
							size={12}
						/>
						<Text variant="text-xs/medium" color={footerDanger ? 'text-feedback-critical' : 'text-muted'}>
							{footer}
						</Text>
					</View>
				</View>
			</View>
		</Pressable>
	)
}

/**
 * Search and filters over a log: Discord's TextInput, then Discord's Buttons as filter chips, the
 * chosen one filled. Not SegmentedControl: its pager inside a scroll view left some phones unable
 * to reach later pages (Shimeji 0.8.x), and these switch plain state with nothing to swipe.
 */
export function FilterBar<T extends string>({
	query,
	onQuery,
	placeholder,
	filters,
	filter,
	onFilter,
}: {
	/** Leave out `onQuery` for filters alone. */
	query?: string
	onQuery?: (value: string) => void
	placeholder?: string
	filters: Array<{ id: T; label: string }>
	filter: T
	onFilter: (value: T) => void
}) {
	const { View } = ReactNative
	const { TextInput, Button } = Design as any
	return (
		<View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
			{onQuery ? (
				<TextInput
					placeholder={placeholder}
					value={query}
					onChange={(value: string) => onQuery(value)}
					isClearable
					returnKeyType="search"
				/>
			) : null}
			<View style={{ flexDirection: 'row', gap: 8 }}>
				{filters.map(option => (
					<View key={option.id} style={{ flex: 1 }}>
						<Button
							size="sm"
							variant={option.id === filter ? 'primary' : 'secondary'}
							text={option.label}
							onPress={() => onFilter(option.id)}
						/>
					</View>
				))}
			</View>
		</View>
	)
}
