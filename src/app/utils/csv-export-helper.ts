export function generateCSVContent(
  headers: string[],
  data: any[],
  mapRowFn: (item: any) => string,
): Blob | null {
  if (!data || data.length === 0) {
    return null;
  }

  const rows = data.map(mapRowFn);

  const csvContent = [headers.join(','), ...rows].join('\n');

  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}
