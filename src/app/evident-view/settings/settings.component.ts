import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { EvidentService } from '../../auth/services/evident.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  @ViewChild('apiKeyInput') apiKeyInput!: ElementRef;
  @ViewChild('tradingAccountInput') tradingAccountInput!: ElementRef;
  @ViewChild('beneficiaryAccountInput') beneficiaryAccountInput!: ElementRef;

  constructor(private evidentService: EvidentService) {}

  ngOnInit(): void {
    this.evidentService.getSettings().subscribe({
      next: (data) => {
        if (data) {
          this.apiKeyInput.nativeElement.value = data.apiKey || '';
          this.tradingAccountInput.nativeElement.value =
            data.defaultTradingAccount || '';
          this.beneficiaryAccountInput.nativeElement.value =
            data.defaultBeneficiaryAccount || '';
        }
      },
      error: (err) => {
        console.error('Failed to load settings', err);
      },
    });
  }

  onSubmit(): void {
    const settings = {
      apiKey: this.apiKeyInput.nativeElement.value,
      defaultTradingAccount: this.tradingAccountInput.nativeElement.value,
      defaultBeneficiaryAccount:
        this.beneficiaryAccountInput.nativeElement.value,
    };

    this.evidentService.saveSettings(settings).subscribe({
      next: () => {
        this.apiKeyInput.nativeElement.value = '';
        this.tradingAccountInput.nativeElement.value = '';
        this.beneficiaryAccountInput.nativeElement.value = '';
      },
      error: (err) => {
        console.error('Error submitting settings:', err);
      },
    });
  }
}
