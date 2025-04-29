import { Component, Input } from '@angular/core';
import { DocumentsUploadService } from '../../auth/services/documents-upload.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

export interface DocumentUpload {
  title: string;
  required: boolean;
  file?: File;
  isUploaded?: boolean;
  targetType: DocumentUploadTargetType;
  documentType: DocumentUploadDocumentType;
  targetId: number;
}

export enum DocumentUploadTargetType {
  ORGANIZATION = 'organization',
  DEVICE = 'device',
  USER = 'user',
}

export enum DocumentUploadDocumentType {
  INCORPORATION_CERTIFICATE = 'incorporation certificate',
  LEGAL_REPRESENTATIVE_PASSPORT = 'legal representative passport',
  ADDRESS_PROOF = 'address proof',
  OWNERS_DECLARATION = 'owners declaration',
}

@Component({
  selector: 'app-documents-upload',
  templateUrl: './documents-upload.component.html',
  styleUrls: ['./documents-upload.component.scss'],
})
export class DocumentsUploadComponent {
  @Input() title: string = 'Document Uploads';
  @Input() description: string =
    '4 recommended documents to upload for your facility registration.';
  @Input() helperText: string =
    'If you require any help with the document uploads, please create a draft, and contact our support team.';
  isUploading: boolean = false;
  numberOfUploadedDocuments: number = 0;
  @Input() documents: DocumentUpload[] = [
    {
      title: 'Legal Entity Incorporation certificate/document',
      required: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentUploadDocumentType.INCORPORATION_CERTIFICATE,
      targetId: 1,
    },
    {
      title: "The legal representative's passport",
      required: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentUploadDocumentType.LEGAL_REPRESENTATIVE_PASSPORT,
      targetId: 1,
    },
    {
      title:
        'Address proof (latest utility bill: mobile phone, electricity bill, bank statement, etc.)',
      required: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentUploadDocumentType.ADDRESS_PROOF,
      targetId: 1,
    },
    {
      title: "Owner's Declaration Document",
      required: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentUploadDocumentType.OWNERS_DECLARATION,
      targetId: 1,
    },
  ];

  constructor(
    private documentService: DocumentsUploadService,
    private toastrService: ToastrService,
    private router: Router,
  ) {}

  onFileSelected(event: any, document: DocumentUpload): void {
    const file = event.target.files[0];
    if (file) {
      document.file = file;
      document.isUploaded = false;
      this.numberOfUploadedDocuments++;
    }
  }

  openFileExplorer(index: number): void {
    document.getElementById('fileInput' + index)?.click();
  }

  shortenFileName(fileName: string, maxLength: number = 20): string {
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

  submit(): void {
    const uploadedDocuments = this.documents.filter(
      (doc) => doc.file && !doc.isUploaded,
    );

    if (uploadedDocuments.length < 4) {
      this.toastrService.warning(
        'Please select all 4 required documents before submitting',
      );
      return;
    }

    this.isUploading = true;
    const uploadObservables = uploadedDocuments.map((doc) =>
      this.documentService.uploadDocument(
        doc.targetType,
        doc.documentType,
        doc.file!,
      ),
    );

    forkJoin(uploadObservables).subscribe({
      next: () => {
        this.documents.forEach((doc) => {
          if (doc.file) {
            doc.isUploaded = true;
          }
        });
        this.toastrService.success('All documents uploaded successfully');
        this.isUploading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        if (err.error.errorType === 'DOCUMENT_ALREADY_UPLOADED') {
          this.toastrService.warning('Some documents were already uploaded');
        } else {
          this.toastrService.error(
            'Error uploading documents',
            err.error.message,
          );
          this.isUploading = false;
        }
      },
      complete: () => {
        this.isUploading = false;
      },
    });
  }
}
