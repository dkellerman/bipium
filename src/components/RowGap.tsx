/**
 * The space between two rows: at least 10px, growing evenly with spare page height up to
 * a cap (smaller on touch screens); anything beyond the caps stays below the last row.
 */
export function RowGap() {
  return (
    <div aria-hidden className="m-0! h-2.5 max-h-7 shrink-0 grow p-0! pointer-fine:max-h-10" />
  );
}
