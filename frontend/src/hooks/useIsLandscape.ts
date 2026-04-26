import { useEffect, useState } from 'react'

const LANDSCAPE_QUERY = '(min-width: 1024px) and (orientation: landscape)'

export function useIsLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(LANDSCAPE_QUERY).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(LANDSCAPE_QUERY)
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isLandscape
}
