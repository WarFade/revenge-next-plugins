/**
 * A toast that reaches Discord 350.2's toast system, shared by every plugin that shows one.
 * Each plugin imports this and passes its own key, so the dedupe stays per plugin.
 *
 * ## Why this shape
 *
 * On 350.2 the old `{ key, content }` toast is dead. `ToastActionCreators.open` first converts the
 * toast through `toManaToast` (`modules/toast/native/toastMapping.tsx`) and only falls back to the
 * legacy `TOAST_OPEN` dispatch when that returns null. The legacy `ToastStore`
 * (`modules/toast/native/ToastStore.tsx`) is now a shell: its `handleOpen` dedupes keys and writes
 * no state, so a legacy toast is silently swallowed and never renders. The new render hook,
 * `useToastContainer` (`ToastContainerUtils.shared.tsx`), reads `storeValue.toast.position` from
 * the mana toast store guarded only against `null`, so a store read that yields `undefined` or an
 * entry without `toast` throws and takes the whole app down at the root render.
 * See `docs/debugging/discord-toast-system.md` for the full trace.
 *
 * `toManaToast` accepts exactly this shape: `content` must be a string, `containerStyle` must be
 * `null` and `disableAnimations` `true` -- anything else and it returns null and the toast falls
 * back to the dead path. `position: null` means "default position" and `toastDurationMs: null` the
 * default duration, which is what every plugin toast wants. Older builds' legacy path only reads
 * `key` and `content`, so the extra fields are harmless there.
 *
 * `revenge.*` is only read inside the function (docs/porting-rules.md rule 1).
 */
export function showToast(content: string, key = 'SharedToast') {
	try {
		// The vendored `ToastActionCreators.open` types describe the pre-350.2 toast shape. The
		// payload 350.2's `toManaToast` actually reads is wider and wants nulls where the old
		// type says undefined (position, toastDurationMs, containerStyle, disableAnimations).
		// See docs/debugging/discord-toast-system.md.
		const toast = {
			key,
			content,
			position: null,
			toastDurationMs: null,
			containerStyle: null,
			disableAnimations: true,
			icon: null,
			IconComponent: null,
			iconColor: null,
		} as any
		revenge.discord.actions.ToastActionCreators.open(toast)
	} catch {
		/* a missing toast must never take the app down */
	}
}
