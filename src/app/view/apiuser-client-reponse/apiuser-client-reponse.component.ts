import { Component,Inject  } from '@angular/core';
// import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-apiuser-client-reponse',
  templateUrl: './apiuser-client-reponse.component.html',
  styleUrls: ['./apiuser-client-reponse.component.scss']
})
export class ApiuserClientReponseComponent {

  constructor(
    public dialogRef: MatDialogRef<ApiuserClientReponseComponent>,
    @Inject(MAT_DIALOG_DATA) public response: any) {}

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
    document.execCommand('copy');
    document.body.removeChild(textArea);
    this.dialogRef.close('copy')
  }
}
