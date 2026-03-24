import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Toast, ToastrService, ToastPackage } from 'ngx-toastr';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-error-toast',
  standalone: false,
  template: `
    <div class="error-toast-wrapper">
      <div *ngIf="title" class="toast-title">{{ title }}</div>
      <div *ngIf="message" class="toast-message">{{ message }}</div>
      <button class="copy-btn" (click)="copyError($event)">
        {{ copied ? 'Copied!' : 'Copy error' }}
      </button>
    </div>
  `,
  styles: [`
    .error-toast-wrapper {
      position: relative;
      padding: 0;
    }
    .toast-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    .toast-message {
      font-size: 13px;
      opacity: 0.9;
      word-break: break-word;
    }
    .copy-btn {
      margin-top: 8px;
      padding: 2px 10px;
      font-size: 11px;
      background: rgba(255,255,255,0.2);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 4px;
      cursor: pointer;
    }
    .copy-btn:hover {
      background: rgba(255,255,255,0.35);
    }
  `],
  animations: [
    trigger('flyInOut', [
      state('inactive', style({ opacity: 0 })),
      transition('inactive => active', animate('300ms ease-out', style({ opacity: 1 }))),
      transition('active => removed', animate('300ms ease-out', style({ opacity: 0 }))),
    ]),
  ],
  preserveWhitespaces: false,
})
export class ErrorToastComponent extends Toast {
  copied = false;

  constructor(
    protected override toastrService: ToastrService,
    public override toastPackage: ToastPackage,
  ) {
    super(toastrService, toastPackage);
  }

  copyError(event: Event): void {
    event.stopPropagation();
    const text = [this.title, this.message].filter(Boolean).join(': ');
    navigator.clipboard.writeText(text).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}
