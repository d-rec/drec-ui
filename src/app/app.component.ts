import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Component({
  standalone: false,
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  constructor(private toastr: ToastrService) {
    // Override error toasts to add a copy-to-clipboard button
    const originalError = this.toastr.error.bind(this.toastr);
    this.toastr.error = (message?: string, title?: string, override?: any) => {
      const ref = originalError(message, title, override);
      // Add copy button after toast renders
      setTimeout(() => {
        const toastEl = ref.toastRef?.componentInstance?.toastPackage
          ? document.querySelector(`.toast-error:last-child`)
          : null;
        if (toastEl) {
          const btn = document.createElement('button');
          btn.textContent = 'Copy error';
          btn.className = 'toast-copy-btn';
          btn.onclick = (e) => {
            e.stopPropagation();
            const text = [title, message].filter(Boolean).join(': ');
            navigator.clipboard.writeText(text).then(() => {
              btn.textContent = 'Copied!';
              setTimeout(() => (btn.textContent = 'Copy error'), 2000);
            });
          };
          toastEl.appendChild(btn);
        }
      });
      return ref;
    };
    this.connectWallet();
  }
  getWindowEthereumProperty(): Ethereum | undefined {
    return window.ethereum;
  }

  async connectWallet() {
    if (
      typeof window != 'undefined' &&
      typeof this.getWindowEthereumProperty() != 'undefined'
    ) {
      const ethereum = this.getWindowEthereumProperty();
      if (ethereum) {
        try {
          /* MetaMask is installed */
          const accounts = await ethereum.request({
            method: 'eth_requestAccounts',
          });
          console.log('Connected accounts:', accounts);
        } catch (err) {
          console.error('Error connecting to MetaMask:', err);
        }
      } else {
        console.error('MetaMask not found');
      }
    }
  }
}
