import { useHotkeys as useHotkeysOriginal } from 'react-hotkeys-hook'
import { Options } from 'react-hotkeys-hook'

/**
 * Generalized hotkey hook for the application.
 *
 * Enforces consistent defaults:
 * - enableOnFormTags: true (Allows hotkeys while typing in inputs)
 * - preventDefault: true (Prevents browser default actions like Save Page)
 *
 * @see https://react-hotkeys-hook.vercel.app/docs/documentation/use-hotkeys/
 */
export function useAppHotkeys(
    keys: string,
    callback: (event: KeyboardEvent, handler: unknown) => void,
    options?: Options
) {
    return useHotkeysOriginal(keys, callback, {
        enableOnFormTags: true,
        preventDefault: true,
        ...options,
    })
}
