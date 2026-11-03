import { lazy, type ComponentType } from 'react'

/** React.lazy untuk modul yang memakai named export */
export function lazyPage<TModule extends Record<string, unknown>, TKey extends keyof TModule & string>(
  loader: () => Promise<TModule>,
  name: TKey,
) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType }))
}
