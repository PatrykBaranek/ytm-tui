import { useCallback, useRef, useState } from 'react';

// State plus a ref that is updated synchronously. Several keys can arrive in one stdin chunk
// (and the player's ended event fires between renders), so handlers read the ref, never a
// value captured by an older render.
export function useLatestState<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const ref = useRef(value);
  const set = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
  }, []);
  return [value, set, ref] as const;
}
