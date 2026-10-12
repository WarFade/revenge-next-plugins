/**
 * Toast helper following kmmiio99o's ToastsAPI specification.
 * https://git.gay/kmmiio99o/revenge-next-plugins/src/branch/main/docs/api.md
 *
 * Soft dependency: uses kmio's ToastsAPI if available, otherwise falls back to
 * shared/toast.ts, which picks the right ToastActionCreators signature for the Discord build.
 */

import { showToast as sharedToast } from '../../../../shared/toast'

let scopedToasts: any

export function setToastApi(api: any) {
	scopedToasts = api
}

function getToasts(): any {
	if (scopedToasts && typeof scopedToasts.show === 'function') {
		return scopedToasts
	}
	// Only the API handed to start() (setToastApi): plugins must not read the global `revenge`.
	return undefined
}

export interface ToastOptions {
	key?: string
	variant?: 'default' | 'success' | 'critical' | 'warning' | 'info'
	duration?: number
}

export function showToast(content: string, options?: ToastOptions) {
	const toasts = getToasts()
	if (typeof toasts?.show === 'function') {
		toasts.show({
			content,
			key: options?.key,
			variant: options?.variant ?? 'default',
			...(options?.duration !== undefined ? { duration: options.duration } : {}),
		})
		return
	}

	sharedToast(content, options?.key ?? 'SendTweaksToast')
}
