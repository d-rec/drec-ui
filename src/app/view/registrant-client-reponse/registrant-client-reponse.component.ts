import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  standalone: false,
  selector: 'app-registrant-client-reponse',
  templateUrl: './registrant-client-reponse.component.html',
  styleUrls: ['./registrant-client-reponse.component.scss'],
})
export class RegistrantClientReponseComponent {
  constructor(
    public dialogRef: MatDialogRef<RegistrantClientReponseComponent>,
    @Inject(MAT_DIALOG_DATA) public response: any,
  ) {}

  // copyToClipboard() {
  //   const textArea = document.createElement('textarea');
  //   textArea.value = this.response;
  //   document.body.appendChild(textArea);
  //   textArea.select();
  //   document.execCommand('copy');
  //   document.body.removeChild(textArea);
  // }
  copyToClipboard() {
    // Format the object data as a string
    const formattedData = `Client_id: ${this.response.client_id}\nClient_Secret: ${this.response.client_secret}`;

    const textArea = document.createElement('textarea');
    textArea.value = formattedData;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('ok');
    document.body.removeChild(textArea);
    // this.dialogRef.close('copy')
  }
}
