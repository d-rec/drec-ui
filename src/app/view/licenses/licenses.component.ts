import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  OrgApiLicensesService,
  LicenseSettings,
} from '../../auth/services/org-api-licenses.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  standalone: false,
  selector: 'app-licenses',
  templateUrl: './licenses.component.html',
  styleUrls: ['./licenses.component.scss'],
})
export class LicensesComponent implements OnInit {
  licensesForm: FormGroup;
  roboflowCredits = 3;
  deeplCredits = 3;
  isAdmin = false;

  constructor(
    private licensesService: OrgApiLicensesService,
    private toastrService: ToastrService,
    private fb: FormBuilder,
  ) {
    this.licensesForm = this.fb.group({
      roboflowApiKey: [''],
      roboflowWorkflowUrl: [''],
      deeplApiKey: [''],
    });
  }

  ngOnInit(): void {
    const user = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    this.isAdmin = user?.role === 'Admin';
    this.loadSettings();
  }

  loadSettings(): void {
    this.licensesService.getSettings().subscribe({
      next: (data: LicenseSettings) => {
        if (data) {
          this.licensesForm.patchValue({
            roboflowApiKey: data.roboflowApiKey || '',
            roboflowWorkflowUrl: data.roboflowWorkflowUrl || '',
            deeplApiKey: data.deeplApiKey || '',
          });
          this.roboflowCredits = data.roboflowCreditsRemaining;
          this.deeplCredits = data.deeplCreditsRemaining;
        }
      },
      error: (err) => {
        console.error('Failed to load license settings', err);
      },
    });
  }

  onSubmit(): void {
    const formValue = this.licensesForm.value;
    const payload: any = {};
    if (formValue.roboflowApiKey !== undefined) {
      payload.roboflowApiKey = formValue.roboflowApiKey || null;
    }
    if (formValue.roboflowWorkflowUrl !== undefined) {
      payload.roboflowWorkflowUrl = formValue.roboflowWorkflowUrl || null;
    }
    if (formValue.deeplApiKey !== undefined) {
      payload.deeplApiKey = formValue.deeplApiKey || null;
    }

    this.licensesService.saveSettings(payload).subscribe({
      next: () => {
        this.toastrService.success('API keys saved successfully');
        this.loadSettings();
      },
      error: (err) => {
        this.toastrService.error('Failed to save API keys');
        console.error('Error saving license settings:', err);
      },
    });
  }

  onCancel(): void {
    this.loadSettings();
  }
}
