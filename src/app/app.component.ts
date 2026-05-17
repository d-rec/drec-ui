import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { BrowserConsolePipeService } from './utils/browser-console-pipe.service';

@Component({
  standalone: false,
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  constructor(
    private toastr: ToastrService,
    // Injected purely for the side effect — its constructor installs the
    // console pipe when staging + ?debug=1. The variable is unused.
    private readonly _browserConsolePipe: BrowserConsolePipeService,
  ) {
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
