import type { Context, ReactNode } from 'react'
import { attachLive, detachLive } from './liveReplace'
import { wrapRender } from './wrapRender'
import { getModuleWithImportedPath } from '@revenge-mod/discord/utils/modules/finders'
import { createContext, createElement } from 'react'
import { reportError } from '../../../../shared/report'

/** The live composer handle, scoped to its own send button through React context. */
type ComposerRef = { current?: { getText?: () => unknown } | null }

let context: Context<ComposerRef | undefined> | undefined

export function composerContext(): Context<ComposerRef | undefined> {
	return (context ??= createContext<ComposerRef | undefined>(undefined))
}

/**
 * Find a ref Discord passes to its autocomplete/accessory children, without component names:
 * `chatInputRef` (the input's handle) or `chatInputStateRef` (its live text, caret and edit id).
 */
function findRef(node: any, prop: string): ComposerRef | undefined {
	if (!node || typeof node !== 'object') return undefined
	if (Array.isArray(node)) {
		for (const child of node) {
			const ref = findRef(child, prop)
			if (ref) return ref
		}
		return undefined
	}
	const ref = node.props?.[prop]
	if (ref && typeof ref === 'object' && 'current' in ref) return ref
	return findRef(node.props?.children, prop)
}

export function patchComposer(): () => void {
	let undo: (() => void) | undefined
	let active = true
	const unsubscribe = getModuleWithImportedPath(
		'modules/chat_input/native/ChatInput.tsx',
		(exports: any) => {
			if (!active || undo) return
			const Context = composerContext()
			// memo(forwardRef) up to 349, memo(function) from 350.2: wrapRender handles both.
			undo = wrapRender(exports, original => function (this: unknown, ...args: any[]) {
				const tree = Reflect.apply(original, this, args) as ReactNode
				if (!active) return tree
				const ref = findRef(tree, 'chatInputRef')
				try {
					// Replace as you type (lib/liveReplace.ts) needs the same handle.
					attachLive(ref as any, findRef(tree, 'chatInputStateRef') as any)
				} catch (error) {
					reportError('[SendTweaks] Replace as you type could not attach:', error)
				}
				return createElement(Context.Provider, { value: ref }, tree)
			})
			if (!undo) reportError('[SendTweaks] could not wrap the chat input: unknown component shape')
		},
	)
	return () => {
		active = false
		unsubscribe?.()
		undo?.()
		detachLive()
	}
}

/** Read at release time, not render time: typing does not necessarily re-render the send button. */
export function readComposer(ref: ComposerRef | undefined): string | undefined {
	const text = ref?.current?.getText?.()
	return typeof text === 'string' ? text : undefined
}
