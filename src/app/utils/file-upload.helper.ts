import { ToastrService } from 'ngx-toastr';

export function validateAndAppendFiles(
  formData: FormData,
  files: File[],
  fileType: string,
  allowedExtensions: string[],
  maxSizeInMB: number,
  toastr: ToastrService,
): { errors: Record<string, string[]>; formData: FormData } {
  const errors: Record<string, string[]> = {};

  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const sizeInMB = file.size / (1024 * 1024);

    if (!errors[fileType]) {
      errors[fileType] = [];
    }

    if (!extension || !allowedExtensions.includes(extension)) {
      const message = `${file.name} has unsupported file type: .${extension}`;
      errors[fileType].push(message);
      continue;
    }

    if (sizeInMB > maxSizeInMB) {
      const message = `${file.name} exceeds max file size of ${maxSizeInMB}MB`;
      errors[fileType].push(message);
      continue;
    }

    formData.append(fileType, file, file.name);
  }

  Object.keys(errors).forEach((key) => {
    if (errors[key].length === 0) {
      delete errors[key];
    }
  });
  Object.values(errors)
    .flat()
    .forEach((message) => toastr.error(message));

  return { errors, formData };
}

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
