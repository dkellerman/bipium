/**
 * Spare page height between two rows. Gaps share the spare height evenly up to a cap
 * (smaller on touch screens); anything beyond the caps stays below the last row.
 */
export function RowGap() {
  return <div aria-hidden className="m-0! h-0 max-h-4 grow p-0! pointer-fine:max-h-6" />;
}
