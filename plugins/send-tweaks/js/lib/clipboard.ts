import * as ReactNative from 'react-native'
import * as clipboardModule from '@revenge-mod/externals/react-native-clipboard'

/** Read explicitly requested clipboard text without depending on a multiline field's paste handling. */
export async function readClipboardText(): Promise<string> {
	const bundled = (clipboardModule as any)?.Clipboard
	const clipboard = bundled ?? (ReactNative as any)?.Clipboard
	if (typeof clipboard?.getString !== 'function') throw new Error('Clipboard is unavailable')
	const text = await clipboard.getString()
	if (typeof text !== 'string') throw new Error('Clipboard did not return text')
	return text
}

/** Clipboard from Revenge's bundled module, falling back to React Native's. False if neither is there. */
export function copyText(text: string): boolean {
	try {
		const bundled = (clipboardModule as any)?.Clipboard
		const clipboard = bundled ?? (ReactNative as any)?.Clipboard
		if (typeof clipboard?.setString !== 'function') return false
		clipboard.setString(text)
		return true
	} catch {
		return false
	}
}
