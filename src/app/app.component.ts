import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  constructor() {
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
