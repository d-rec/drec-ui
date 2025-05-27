import { Component } from '@angular/core';
import { AuthbaseService } from '../../auth/authbase.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

@Component({
  selector: 'app-download-api-key',
  templateUrl: './download-api-key.component.html',
})
export class DownloadApiKeyComponent {
  userApiId: string = '';
  constructor(
    private authService: AuthbaseService,
    private toastrService: ToastrService,
    private router: Router,
  ) {
    this.userApiId = sessionStorage.getItem('apiuserId') || '';
  }

  downloadAccessKey(keydata: any): void {
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

  createAccessKey(): void {
    this.authService
      .ApiUserExportAccesskey('user/export-accesskey/', this.userApiId)
      .subscribe({
        next: (keydata) => {
          this.downloadAccessKey(keydata);
          this.toastrService.success(
            'Access key downloaded successfully',
            'Success',
          );
          this.router.navigate(['/apiuser/permission/request/form']);
        },
        error: (error) => {
          this.toastrService.error('Error downloading access key', 'Error');
        },
      });
  }
}
