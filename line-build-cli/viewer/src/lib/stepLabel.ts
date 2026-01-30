export function formatStepLabel(orderIndex: number): string {
  // We use 1-based indexing for humans (S01, S02, ...)
  const humanIndex = orderIndex + 1;
  return `S${humanIndex.toString().padStart(2, '0')}`;
}
