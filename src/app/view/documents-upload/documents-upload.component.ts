import { Component, Input } from '@angular/core';
import { DocumentsUploadService } from 'src/app/auth/services/documents-upload.service';
import { ToastrService } from 'ngx-toastr';
export interface DocumentUpload {
  title: string;
  isRecommended: boolean;
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
  constructor(
    private documentService: DocumentsUploadService,
    private toastrService: ToastrService,
  ) {}

  @Input() title: string = 'Document Uploads';
  @Input() description: string =
    '4 recommended documents to upload for your facility registration.';
  @Input() helperText: string =
    'If you require any help with the document uploads, please create a draft, and contact our support team.';
  @Input() documents: DocumentUpload[] = [
    {
      title: 'Legal Entity Incorporation certificate/document',
      isRecommended: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentUploadDocumentType.INCORPORATION_CERTIFICATE,
      targetId: 1,
    },
    {
      title: "The legal representative's passport",
      isRecommended: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentUploadDocumentType.LEGAL_REPRESENTATIVE_PASSPORT,
      targetId: 1,
    },
    {
      title:
        'Address proof (latest utility bill: mobile phone, electricity bill, bank statement, etc.)',
      isRecommended: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentUploadDocumentType.ADDRESS_PROOF,
      targetId: 1,
    },
    {
      title: "Owner's Declaration Document",
      isRecommended: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentUploadDocumentType.OWNERS_DECLARATION,
      targetId: 1,
    },
  ];

  onFileSelected(event: any, document: DocumentUpload) {
    const file = event.target.files[0];
    if (file) {
      document.file = file;
      document.isUploaded = false;
    }
  }

  openFileExplorer(index: number) {
    document.getElementById('fileInput' + index)?.click();
  }

  upload(document: DocumentUpload) {
    if (!document.file) return;

    this.documentService
      .uploadDocument(
        document.targetId,
        document.targetType,
        document.documentType,
        document.file,
      )
      .subscribe({
        next: () => {
          document.isUploaded = true;
          document.file = undefined;
          this.toastrService.success('Document uploaded successfully');
        },
        error: (err) => {
          this.toastrService.error(
            'Error uploading document',
            err.error.message,
          );
        },
      });
  }
}
