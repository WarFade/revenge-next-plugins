import type { ChangelogEntry } from '../../../shared/changelog'

/** Newest first. Every version users got gets an entry; see shared/changelog.tsx. */
export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '0.1.2',
		date: '2026-10-13',
		title: 'Tidy-up',
		changes: ['Errors now show in the Revenge plugin list instead of only the log, and the developer Debug page is gone from normal builds.'],
	},
	{
		version: '0.1.1',
		date: '2026-10-04',
		title: 'First release',
		changes: [
			'Removes the thin lines between rows in settings and other lists.',
			'A settings page with the changelog.',
		],
	},
]
