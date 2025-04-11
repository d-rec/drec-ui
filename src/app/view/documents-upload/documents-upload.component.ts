import { Component, Input } from '@angular/core';

export interface DocumentUpload {
  title: string;
  isRecommended: boolean;
  isOptional?: boolean;
  file?: File;
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
      title: 'Legal Entity Incorporation certificate/document',
      isRecommended: true,
    },
    { title: "The legal representative's passport", isRecommended: true },
    {
      title:
        'Address proof (latest utility bill: mobile phone, electricity bill, bank statement, etc.)',
      isRecommended: true,
    },
    { title: "Owner's Declaration Document", isRecommended: true },
  ];

  onFileSelected(event: any, document: DocumentUpload) {
    const file = event.target.files[0];
    if (file) {
      document.file = file;
    }
  }

  uploadFile(document: DocumentUpload) {
    if (!document.file) {
      return;
    }
    // Here you would typically call your service to handle the file upload
    console.log(`Uploading file for ${document.title}:`, document.file);
  }

  openFileInput(index: number) {
    document.getElementById('fileInput' + index)?.click();
  }

  submitDocuments() {
    const uploadedDocs = this.documents.filter((doc) => doc.file);
    const missingRecommendedDocs = this.documents.filter(
      (doc) => doc.isRecommended && !doc.file,
    );

    if (missingRecommendedDocs.length > 0) {
      console.warn(
        'Missing recommended documents:',
        missingRecommendedDocs.map((doc) => doc.title),
      );
      // Here you might want to show a warning to the user about missing recommended documents
      return;
    }

    if (uploadedDocs.length === 0) {
      console.warn('No documents uploaded');
      return;
    }

    // Here you would typically call your service to submit all documents
    console.log('Submitting documents:', uploadedDocs);
  }
}
