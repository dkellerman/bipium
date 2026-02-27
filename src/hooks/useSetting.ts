import { useEffect, useState } from 'react';
import sessionStorage from 'sessionstorage';
import qs from 'query-string';
import type { StorageLike, TransformFn, UseSettingReturn } from '../types';

const q = qs.parse(window.location.search);
const identityTransform = <T>(value: unknown) => value as T;

export function useSetting<T>(
  id: string,
  defVal: T,
  transform: TransformFn<T> = identityTransform,
  storage: StorageLike = sessionStorage as StorageLike,
): UseSettingReturn<T> {
  const sget = (key: string) => (storage ? storage.getItem(key) : null);
  const initialValue = 'reset' in q ? defVal : q[id] || sget(id) || defVal;
  const [val, setVal] = useState<T>(transform(initialValue));

  useEffect(() => {
    const sset = (key: string, nextVal: T) =>
      storage && !q[key] ? storage.setItem(key, nextVal) : null;
    sset(id, val);
  }, [val, id, storage]);

  return [val, setVal];
}
