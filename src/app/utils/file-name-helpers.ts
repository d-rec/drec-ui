export function shortenFileName(
  fileName: string,
  maxLength: number = 20,
): string {
  if (!fileName || fileName.length <= maxLength) {
    return fileName;
  }

  const extension = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.'))
    : '';
  const nameWithoutExtension = fileName.slice(0, fileName.lastIndexOf('.'));

  const halfLength = Math.floor((maxLength - 3 - extension.length) / 2);
  const start = nameWithoutExtension.slice(0, halfLength);
  const end = nameWithoutExtension.slice(
    nameWithoutExtension.length - halfLength,
  );

  return `${start}...${end}${extension}`;
}
