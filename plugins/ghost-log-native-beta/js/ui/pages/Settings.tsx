import { rowIcon } from '../icon'
import { useBottomPadding } from '../safeArea'
import { EDITS_ROUTE, LOG_ROUTE, MEDIA_ROUTE, OPTIONS_ROUTE, VISUALS_ROUTE, BACKUP_ROUTE, LICENSE_ROUTE, DEBUG_ROUTE } from '../routes'
import { useLog, useStorageStatus } from '../state'
import { useEdits } from '../../lib/edits'
import { allSavedMedia, formatBytes } from '../../lib/media'
import { useChangelog } from '../../../../../shared/changelog'

/**
 * Root page. The warning card (this is a message logger), then what has been caught, then how it is
 * caught and kept, then the licence and the developer page.
 */
export default function Settings() {
	const { Page } = revenge.components
	const { ScrollView, View } = revenge.react.ReactNative
	const { Stack, Text, Card, TableRowGroup, TableRow } = revenge.discord.design.Design
	const { useNavigation } = revenge.externals.ReactNavigation.ReactNavigationNative

	const navigation = useNavigation() as { navigate: (route: string) => void }
	// The changelog icon at the top right, and "What's new" once after an update.
	useChangelog()
	const entries = useLog()
	const edited = useEdits()
	const status = useStorageStatus()
	const media = allSavedMedia(entries)
	const mediaBytes = media.reduce((sum, item) => sum + (item.size ?? 0), 0)

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<Card
						variant="secondary"
						border="none"
						style={{
							backgroundColor: '#f0b2321f',
							borderColor: '#f0b23266',
							borderWidth: 1,
						}}
					>
						<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
							<Text color="text-feedback-warning" variant="text-md/semibold" style={{ textAlign: 'center' }}>
								⚠️ This is a message logger
							</Text>
							<Text color="text-muted" variant="text-sm/normal" style={{ marginTop: 8 }}>
								Deleted and edited messages are kept, encrypted, on this device. Client mods break
								Discord's Terms of Service, and message loggers are the kind most associated with accounts
								being actioned. Only you can see the log, but the risk is yours.
							</Text>
						</View>
					</Card>

					{/* Fail loudly, on the page users actually land on. A backup location Android refuses
					    used to be silent, and silently losing every catch is the worst failure this
					    plugin has. */}
					{status?.usingFallback ? (
						<Card
							variant="secondary"
							border="none"
							style={{ backgroundColor: '#da373c1f', borderColor: '#da373c66', borderWidth: 1 }}
						>
							<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
								<Text color="text-feedback-critical" variant="text-md/semibold">
									Backup location unusable
								</Text>
								<Text color="text-muted" variant="text-sm/normal" style={{ marginTop: 8 }}>
									{`Android refused ${status.requestedDir}, and no permission exists that would allow it. Everything is being written to app storage instead. Open Backup to change the location or export a portable bundle.`}
								</Text>
							</View>
						</Card>
					) : null}

					<TableRowGroup
						title="Caught"
						description="Only messages Discord had loaded can be caught. One deleted in a channel you never opened was never on this device."
						hasIcons
					>
						<TableRow
							label="Deleted messages"
							subLabel={entries.length ? `${entries.length} caught` : 'Nothing caught yet'}
							icon={rowIcon('TrashIcon', 'ic_trash')}
							arrow
							onPress={() => navigation.navigate(LOG_ROUTE)}
						/>
						<TableRow
							label="Edited messages"
							subLabel={edited.length ? `${edited.length} with earlier versions` : 'Nothing caught yet'}
							icon={rowIcon('PencilIcon', 'ic_edit')}
							arrow
							onPress={() => navigation.navigate(EDITS_ROUTE)}
						/>
						<TableRow
							label="Deleted media"
							subLabel={
								media.length
									? `${media.length} saved${mediaBytes ? ` · ${formatBytes(mediaBytes)}` : ''}`
									: 'Nothing saved yet'
							}
							icon={rowIcon('ImagesIcon', 'ImageIcon')}
							arrow
							onPress={() => navigation.navigate(MEDIA_ROUTE)}
						/>
					</TableRowGroup>

					<TableRowGroup title="Options" hasIcons>
						<TableRow
							label="Logging"
							subLabel="What gets caught, notifications, limits"
							icon={rowIcon('SettingsIcon', 'ic_settings')}
							arrow
							onPress={() => navigation.navigate(OPTIONS_ROUTE)}
						/>
						<TableRow
							label="Visual style"
							subLabel="How deleted messages look in chat"
							icon={rowIcon('PaintPaletteIcon', 'PaintbrushThinIcon')}
							arrow
							onPress={() => navigation.navigate(VISUALS_ROUTE)}
						/>
						<TableRow
							label="Backup"
							subLabel="Where the log is kept, export and restore"
							icon={rowIcon('FolderIcon', 'ic_folder')}
							arrow
							onPress={() => navigation.navigate(BACKUP_ROUTE)}
						/>
					</TableRowGroup>

					<TableRowGroup title="About" hasIcons>
						<TableRow
							label="Licence"
							subLabel="CC0-1.0, with parts under BSD-3-Clause"
							icon={rowIcon('BookCheckIcon', 'InformationIcon', 'ic_info')}
							arrow
							onPress={() => navigation.navigate(LICENSE_ROUTE)}
						/>
					</TableRowGroup>

					<TableRowGroup title="Developer" hasIcons>
						<TableRow
							label="Debug"
							subLabel="Message-load probe for the restore feature"
							icon={rowIcon('BugIcon', 'ic_debug')}
							arrow
							onPress={() => navigation.navigate(DEBUG_ROUTE)}
						/>
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
