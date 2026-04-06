import { Component, NgZone } from '@angular/core';
import { NgIf } from '@angular/common';
import { Toast, ToastrService, ToastPackage } from 'ngx-toastr';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

@Component({
  selector: '[toast-component]',
  standalone: true,
  imports: [NgIf],
  template: `
    <button
      *ngIf="options.closeButton"
      (click)="remove()"
      type="button"
      class="toast-close-button"
      aria-label="Close"
    >
      <span aria-hidden="true">&times;</span>
    </button>
    <div *ngIf="title" [class]="options.titleClass" [attr.aria-label]="title">
      {{ title }}
      <ng-container *ngIf="duplicatesCount"
        >[{{ duplicatesCount + 1 }}]</ng-container
      >
    </div>
    <div
      *ngIf="message && options.enableHtml"
      role="alert"
      [class]="options.messageClass"
      [innerHTML]="message"
    ></div>
    <div
      *ngIf="message && !options.enableHtml"
      role="alert"
      [class]="options.messageClass"
      [attr.aria-label]="message"
    >
      {{ message }}
    </div>
    <div *ngIf="options.progressBar">
      <div class="toast-progress" [style.width]="width() + '%'"></div>
    </div>
    <button *ngIf="toastPackage.toastType === 'toast-error'" class="copy-btn" (click)="copyError($event)">
      {{ copied ? 'Copied!' : 'Copy error' }}
    </button>
  `,
  styles: [
    `
      .copy-btn {
        margin-top: 8px;
        padding: 2px 10px;
        font-size: 11px;
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.4);
        border-radius: 4px;
        cursor: pointer;
      }
      .copy-btn:hover {
        background: rgba(255, 255, 255, 0.35);
      }
    `,
  ],
  animations: [
    trigger('flyInOut', [
      state('inactive', style({ opacity: 0 })),
      state('active', style({ opacity: 1 })),
      transition(
        'inactive => active',
        animate('{{ easeTime }}ms {{ easing }}'),
      ),
      transition('active => removed', animate('{{ easeTime }}ms {{ easing }}')),
    ]),
  ],
  preserveWhitespaces: false,
})
export class ErrorToastComponent extends Toast {
  copied = false;

  constructor(
    protected override toastrService: ToastrService,
    public override toastPackage: ToastPackage,
    protected override ngZone: NgZone,
  ) {
    super(toastrService, toastPackage, ngZone);
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
