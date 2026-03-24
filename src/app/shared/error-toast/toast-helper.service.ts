import { Injectable } from '@angular/core';
import { ToastrService, IndividualConfig } from 'ngx-toastr';
import { ErrorToastComponent } from './error-toast.component';

@Injectable({ providedIn: 'root' })
export class ToastHelperService {
  constructor(private toastr: ToastrService) {}

  error(message: string, title?: string, override?: Partial<IndividualConfig>) {
    return this.toastr.error(message, title, {
      ...override,
      toastComponent: ErrorToastComponent,
    });
  }
}
