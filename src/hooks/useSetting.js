import { useEffect, useState } from 'react';
import sessionStorage from 'sessionstorage';
import qs from 'query-string';

const q = qs.parse(window.location.search);

export function useSetting(id, defVal, transform = x => x, storage = sessionStorage) {
  const sget = id => (storage ? storage.getItem(id) : null);
  const [val, setVal] = useState('reset' in q ? defVal : q[id] || sget(id) || defVal);

  useEffect(() => {
    const sset = (id, val) => (storage && !q[id] ? storage.setItem(id, val) : null);
    sset(id, val);
  }, [val, id, storage]);

  return [transform(val), setVal];
}
