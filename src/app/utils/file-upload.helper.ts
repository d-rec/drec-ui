import { ToastrService } from 'ngx-toastr';

export function validateAndAppendFiles(
  formData: FormData,
  files: File[],
  fileType: string,
  allowedExtensions: string[],
  maxSizeInMB: number,
  toastr: ToastrService,
): { allFilesValid: boolean; needsUpdate: boolean } {
  let needsUpdate = false;
  let allFilesValid = true;

  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const sizeInMB = file.size / (1024 * 1024);

    if (!extension || !allowedExtensions.includes(extension)) {
      toastr.error(
        `${file.name} has unsupported file type: .${extension}`,
        'Invalid File Type',
      );
      allFilesValid = false;
      needsUpdate = true;
      break;
    }

    if (sizeInMB > maxSizeInMB) {
      toastr.error(
        `${file.name} exceeds max file size of ${maxSizeInMB}MB`,
        'File Size Exceeded',
      );
      allFilesValid = false;
      break;
    }

    formData.append(fileType, file, file.name);
  }

  return { allFilesValid, needsUpdate };
}
