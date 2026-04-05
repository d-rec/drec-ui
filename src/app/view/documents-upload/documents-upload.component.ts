import { Component, Input } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { OrganizationService } from '../../auth/services/organization.service';
import { AuthbaseService } from '../../auth/authbase.service';
import { DocumentType, OrganizationType } from '.././../utils/drec.enum';
import { UserService } from '../../auth/services';
import { map } from 'rxjs';

export interface DocumentUpload {
  title: string;
  required: boolean;
  file?: File;
  isUploaded?: boolean;
  targetType: DocumentUploadTargetType;
  documentType: DocumentType;
  targetId: number;
}

export enum DocumentUploadTargetType {
  ORGANIZATION = 'organization',
  DEVICE = 'device',
  USER = 'user',
}

@Component({
  standalone: false,
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
      documentType: DocumentType.INCORPORATION_CERTIFICATE,
      targetId: 1,
    },
    {
      title: "The legal representative's passport",
      required: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentType.LEGAL_REPRESENTATIVE_PASSPORT,
      targetId: 1,
    },
    {
      title:
        'Address proof (latest utility bill: mobile phone, electricity bill, bank statement, etc.)',
      required: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentType.ADDRESS_PROOF,
      targetId: 1,
    },
    {
      title: "Owner's Declaration Document",
      required: true,
      file: undefined,
      isUploaded: false,
      targetType: DocumentUploadTargetType.ORGANIZATION,
      documentType: DocumentType.OWNERS_DECLARATION,
      targetId: 1,
    },
  ];
  userApiId: string = '';

  constructor(
    private organizationService: OrganizationService,
    private toastrService: ToastrService,
    private router: Router,
    private authService: AuthbaseService,
    private userService: UserService,
  ) {
    this.getUserApiId();
  }

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

  private downloadAccessKey(keydata: any): void {
    const blob = new Blob([keydata], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.userApiId}.pem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  getUserApiId(): void {
    this.userService
      .userProfile()
      .pipe(
        map((user: any) => {
          this.userApiId = user.api_user_id;
        }),
      )
      .subscribe();
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
    const formData = new FormData();

    let targetType: DocumentUploadTargetType | null = null;

    uploadedDocuments.forEach((doc) => {
      if (doc.file && doc.documentType) {
        formData.append(doc.documentType, doc.file);
        targetType = doc.targetType;
      }
    });

    if (!targetType) {
      this.toastrService.error('Missing target type.');
      this.isUploading = false;
      return;
    }

    this.organizationService
      .uploadVerificationDocuments(formData, targetType)
      .subscribe({
        next: () => {
          this.documents.forEach((doc) => {
            if (doc.file) {
              doc.isUploaded = true;
            }
          });
          this.toastrService.success('All documents uploaded successfully');
          this.isUploading = false;
          const user = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
          if (user.role === OrganizationType.Registrant) {
            this.authService
              .RegistrantExportAccesskey('user/export-accesskey/', this.userApiId)
              .subscribe({
                next: (keydata: any) => {
                  this.downloadAccessKey(keydata);
                },
              });

            this.toastrService.success('Access key downloaded successfully');
            this.router.navigate(['/registrant/permission/request/form']);
          } else {
            this.router.navigate(['/dashboard']);
          }
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
