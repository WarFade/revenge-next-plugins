import type { ChangelogEntry } from '../../../shared/changelog'

/** Newest first. Every version users got gets an entry; see shared/changelog.tsx. */
export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '0.2.4',
		date: '2026-10-13',
		title: 'False error',
		changes: ['No more "profile store found but unusable" error in the Revenge plugin list. Nothing was actually wrong.'],
	},
	{
		version: '0.2.3',
		date: '2026-10-13',
		title: 'Tidy-up',
		changes: ['Errors now show in the Revenge plugin list instead of only the log, and the developer Debug page is gone from normal builds.'],
	},
	{
		version: '0.2.2',
		date: '2026-10-13',
		title: 'Discord 350.4',
		changes: ['Pop-up messages work on Discord 350.4. Before, showing one could crash Discord.'],
	},
	{
		version: '0.2.1',
		date: '2026-10-11',
		title: 'Pronouns load on their own',
		changes: [
			"Server pronouns now load without opening the person's profile.",
			'A badge that had to wait for its data no longer gets stuck without one, and a server pronoun replaces the profile one as soon as it arrives.',
			'A failed lookup is tried again instead of being treated as "no pronouns" for an hour.',
		],
	},
	{
		version: '0.2.0',
		date: '2026-10-11',
		title: 'Pick whose pronouns show',
		changes: [
			'Choose Everyone, Only people I pick, or Everyone except people I hide in settings.',
			'Long-press a message and choose Show their pronouns or Hide their pronouns to add someone; tap them in settings to remove them.',
			'Setting your own pronouns for someone now updates badges that were already showing.',
		],
	},
	{
		version: '0.1.1',
		date: '2026-10-11',
		title: 'Badges appear on their own',
		changes: [
			'Pronouns now show up without opening anyone’s profile first: the message cache and profile store are found on Discord 350.4, and fetched results redraw the waiting rows.',
		],
	},
	{
		version: '0.1.0',
		date: '2026-10-11',
		title: 'Pronouns in chat',
		changes: [
			"A person's pronouns show as a small tag next to their name in chat, from their Discord profile when they set them and from PronounDB otherwise.",
			'Long-press a message and choose Pronouns… to set your own for that person, or clear one.',
		],
	},
]
