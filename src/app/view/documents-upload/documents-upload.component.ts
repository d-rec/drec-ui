import { Component, Input } from '@angular/core';

export interface DocumentUpload {
  title: string;
  isRecommended: boolean;
  isOptional?: boolean;
}

@Component({
  selector: 'app-documents-upload',
  templateUrl: './documents-upload.component.html',
  styleUrls: ['./documents-upload.component.scss'],
})
export class DocumentsUploadComponent {
  @Input() title: string = 'Document Uploads';
  @Input() description: string =
    'For the best chance of approval, there are 5 recommended documents to upload for your facility registration.';
  @Input() helperText: string =
    'If you require any help with the document uploads, please create a draft, and contact your Local Issuer.';
  @Input() documents: DocumentUpload[] = [
    {
      title: 'Form SF-02 - Production Facility Registration',
      isRecommended: true,
    },
    {
      title: "SF-02C Owner's Declaration or Proof of Ownership",
      isRecommended: true,
    },
    { title: 'Metering Evidence', isRecommended: true },
    { title: 'Single Line Diagram', isRecommended: true },
    { title: 'Project Photos', isRecommended: true },
    {
      title: 'Additional documents and notes',
      isRecommended: false,
      isOptional: true,
    },
  ];
}
