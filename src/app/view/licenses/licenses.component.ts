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
  anthropicCredits = 50;
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
      anthropicApiKey: [''],
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
            anthropicApiKey: data.anthropicApiKey || '',
          });
          // Loaded values aren't user edits — mark the form pristine so
          // an immediate Save without typing won't re-send them.
          this.licensesForm.markAsPristine();
          this.roboflowCredits = data.roboflowCreditsRemaining;
          this.deeplCredits = data.deeplCreditsRemaining;
          this.anthropicCredits = data.anthropicCreditsRemaining;
        }
      },
      error: (err) => {
        const apiMsg =
          err?.error?.message ||
          err?.error?.error ||
          err?.message ||
          'Unknown error';
        const status = err?.status ? ` (HTTP ${err.status})` : '';
        this.toastrService.error(
          `Failed to load license settings${status}: ${apiMsg}`,
          'Load failed',
          { timeOut: 8000 },
        );
        console.error('Failed to load license settings', err);
      },
    });
  }

  onSubmit(): void {
    // Only ship fields the user actually touched. Sending unchanged fields
    // (especially blank ones) used to wipe valid keys when the form
    // rendered without populated values for any reason.
    const payload: any = {};
    const c = this.licensesForm.controls;
    if (c['roboflowApiKey'].dirty) {
      payload.roboflowApiKey = c['roboflowApiKey'].value || '';
    }
    if (c['roboflowWorkflowUrl'].dirty) {
      payload.roboflowWorkflowUrl = c['roboflowWorkflowUrl'].value || '';
    }
    if (c['deeplApiKey'].dirty) {
      payload.deeplApiKey = c['deeplApiKey'].value || '';
    }
    if (c['anthropicApiKey'].dirty) {
      payload.anthropicApiKey = c['anthropicApiKey'].value || '';
    }

    if (Object.keys(payload).length === 0) {
      this.toastrService.info('No changes to save');
      return;
    }

    this.licensesService.saveSettings(payload).subscribe({
      next: () => {
        this.toastrService.success('API keys saved successfully');
        this.loadSettings();
      },
      error: (err) => {
        const apiMsg =
          err?.error?.message ||
          err?.error?.error ||
          err?.message ||
          'Unknown error';
        const status = err?.status ? ` (HTTP ${err.status})` : '';
        this.toastrService.error(
          `Failed to save API keys${status}: ${apiMsg}`,
          'Save failed',
          { timeOut: 8000, enableHtml: false },
        );
        console.error('Error saving license settings:', err);
      },
    });
  }

  onCancel(): void {
    this.loadSettings();
  }
}
