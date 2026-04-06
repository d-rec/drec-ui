import { Component, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import {
  DeviceService,
  AdminService,
  OrganizationService,
} from '../../../auth/services';
import { Router } from '@angular/router';
import { OrganizationInformation } from '../../../models';
import { BulkUploadService } from '../../../auth/services/bulk-upload.service';
import { BulkUploadType } from '../../../utils/enums/bulk-upload-type.enum';

@Component({
  standalone: false,
  selector: 'app-add-bulk-device',
  templateUrl: './add-bulk-device.component.html',
  styleUrls: ['./add-bulk-device.component.scss'],
})
export class AddBulkDeviceComponent implements OnInit {
  currentFile?: File | null;
  progress = 0;
  message = '';
  pageSize: number = 10;
  fileName = 'Please click here to select file';
  fileInfos?: Observable<any>;
  showBulkUploadLogs: boolean = false;
  DevicestatusList: any = [];
  loading: boolean = true;
  objectKeys = Object.keys;
  displayedColumns = [
    'serialno',
    'createdAt',
    'jobId',
    'fileId',
    'status',
    'actions',
  ];
  displayedColumns1 = [
    'serialno',
    'serialNumber',
    'errorsList',
    'Status',
    'Action',
  ];
  constructor(
    private deviceService: DeviceService,
    private router: Router,
    private toastrService: ToastrService,
    private adminService: AdminService,
    private orgService: OrganizationService,
    private bulkUploadService: BulkUploadService,
  ) {
    this.loggedInUser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  dataSource1: MatTableDataSource<any>;
  data: any;
  orglist: OrganizationInformation[] = [];
  organizationId: number;
  loggedInUser: any;
  get orgSelectorShown(): boolean {
    return this.loggedInUser?.role === 'Registrant';
  }
  get canUpload(): boolean {
    return this.loggedInUser?.role !== 'Admin';
  }

  ngOnInit(): void {
    if (this.loggedInUser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType !== 'Buyer',
        );
      });
    } else if (this.loggedInUser.role === 'Registrant') {
      this.orgService.GetRegistrantAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org) => org.organizationType != 'Buyer',
        );
      });
    }
    this.displayBulkUploads();
  }
  dragOver = false;

  reset() {
    this.currentFile = null;
    this.fileName = 'Please click here to select file';
  }

  selectFile(event: any): void {
    if (event.target.files && event.target.files[0]) {
      this.handleFile(event.target.files[0]);
    }
    event.target.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  private handleFile(file: File): void {
    if (!file.name.endsWith('.csv')) {
      this.fileName = 'Invalid file — only .csv allowed';
      this.currentFile = null;
      return;
    }
    this.currentFile = file;
    this.fileName = file.name;
  }

  openFileExplorer() {
    if (this.orgSelectorShown && !this.organizationId) {
      this.toastrService.warning('Please select an organization first');
      return;
    }
    document.getElementById('fileInput')?.click();
  }

  onDropZoneDrop(event: DragEvent): void {
    if (this.orgSelectorShown && !this.organizationId) {
      event.preventDefault();
      event.stopPropagation();
      this.dragOver = false;
      this.toastrService.warning('Please select an organization first');
      return;
    }
    this.onDrop(event);
  }

  async downloadFile() {
    try {
      await this.bulkUploadService.downloadFile(BulkUploadType.Devices);
      this.toastrService.success('File downloaded successfully');
    } catch (error) {
      this.toastrService.error('Failed to download file');
    }
  }

  lastError: string | null = null;

  uploading: boolean = false;
  processing: boolean = false;
  uploadElapsed: number = 0;
  processingJobId: string | null = null;
  private uploadTimer: any = null;
  private processingPoll: any = null;

  upload(): void {
    if (this.uploading || this.processing) return;
    if (!this.currentFile) return;
    const organizationId = this.organizationId;
    this.uploading = true;
    this.lastError = null;
    this.uploadElapsed = 0;
    const started = Date.now();
    this.uploadTimer = setInterval(() => {
      this.uploadElapsed = Math.floor((Date.now() - started) / 100) / 10;
    }, 100);
    this.bulkUploadService
      .bulkUpload({
        file: this.currentFile,
        organizationId,
        bulkUploadType: BulkUploadType.Devices,
      })
      .subscribe({
        next: (job: any) => {
          this.uploading = false;
          this.currentFile = null;
          this.fileName = 'Please click here to Select File';
          this.toastrService.success(
            'File uploaded — server is now processing rows',
            'Upload accepted',
          );
          this.processing = true;
          this.processingJobId = job?.jobId ?? null;
          this.pollUntilDone();
        },
        error: (err) => {
          this.uploading = false;
          clearInterval(this.uploadTimer);
          const msg = err?.error?.message ?? err?.message ?? 'Unknown error';
          this.lastError = err?.error?.statusCode === 403 ? 'You are Unauthorized' : msg;
          this.toastrService.error(this.lastError!, 'Upload failed');
        },
      });
  }

  private pollUntilDone(): void {
    clearInterval(this.processingPoll);
    const targetJobId = this.processingJobId;
    this.processingPoll = setInterval(() => {
      this.bulkUploadService
        .getBulkUploads(BulkUploadType.Devices)
        .subscribe((data) => {
          this.data = data;
          this.dataSource = new MatTableDataSource(this.data.bulkUploadJobs);
          this.dataSource.sort = this.sort;
          const job = this.data.bulkUploadJobs?.find(
            (j: any) => j.jobId === targetJobId,
          );
          if (
            job &&
            (job.status === 'Completed' ||
              job.status === 'Failed' ||
              job.status === 'PendingConfirmation')
          ) {
            clearInterval(this.processingPoll);
            clearInterval(this.uploadTimer);
            this.processing = false;
            if (job.status === 'Completed') {
              this.toastrService.success('Processing complete', 'Done');
            } else if (job.status === 'PendingConfirmation') {
              this.toastrService.info(
                'Parsed — review rows then click Import',
                'Ready for review',
              );
              this.openPreview(job.id, job.organizationId);
            } else {
              this.toastrService.error('Processing finished with errors', 'Failed');
            }
          }
        });
    }, 500);
  }

  clearing: boolean = false;
  clearHistory(): void {
    if (this.clearing) return;
    if (
      !confirm(
        'Delete all Completed/Failed bulk upload records from the history? (Jobs still in progress will be kept.)',
      )
    )
      return;
    this.clearing = true;
    this.bulkUploadService
      .clearBulkUploadHistory(BulkUploadType.Devices)
      .subscribe({
        next: (res) => {
          this.clearing = false;
          this.toastrService.success(
            `Deleted ${res?.deleted ?? 0} record(s)`,
            'History cleared',
          );
          this.displayBulkUploads();
        },
        error: (err) => {
          this.clearing = false;
          this.toastrService.error(
            err?.error?.message ?? err?.message ?? 'Failed to clear history',
            'Clear failed',
          );
        },
      });
  }

  refreshing: boolean = false;
  displayBulkUploads() {
    if (this.refreshing) return;
    this.showBulkUploadLogs = false;
    this.refreshing = true;
    this.bulkUploadService
      .getBulkUploads(BulkUploadType.Devices)
      .subscribe({
        next: (data) => {
          this.refreshing = false;
          this.data = data;
          this.dataSource = new MatTableDataSource(this.data.bulkUploadJobs);
          this.dataSource.sort = this.sort;
        },
        error: (err) => {
          this.refreshing = false;
          this.toastrService.error(
            err?.error?.message ?? err?.message ?? 'Failed to load jobs',
            'Refresh failed',
          );
        },
      });
  }
  // Preview (two-stage bulk upload) state
  showPreview: boolean = false;
  previewBulkUploadId: string | null = null;
  previewRecords: any[] = [];
  previewDataSource: MatTableDataSource<any>;
  previewColumns = ['row', 'siteName', 'serialNumber', 'capacity', 'countryCode', 'commissioningDate'];
  previewBusy: boolean = false;
  previewTotalCsvRows: number = 0;
  previewSkippedRows: number = 0;

  openPreview(bulkUploadId: string, organizationId: number) {
    this.bulkUploadService.getBulkUploadPreview(bulkUploadId).subscribe({
      next: (res) => {
        this.previewBulkUploadId = bulkUploadId;
        this.previewRecords = res.records ?? [];
        this.previewTotalCsvRows = res.totalCsvRows ?? 0;
        this.previewSkippedRows = res.skippedRows ?? 0;
        this.previewDataSource = new MatTableDataSource(this.previewRecords);
        this.showPreview = true;
      },
      error: (err) => {
        console.error('[PREVIEW] error', err);
        this.toastrService.error(
          err?.error?.message ?? err?.message ?? 'Failed to load preview',
          'Preview unavailable',
        );
      },
    });
  }

  confirmPreview() {
    if (!this.previewBulkUploadId || this.previewBusy) return;
    this.previewBusy = true;
    this.bulkUploadService
      .confirmBulkUpload(this.previewBulkUploadId)
      .subscribe({
        next: (res) => {
          this.previewBusy = false;
          this.showPreview = false;
          this.previewBulkUploadId = null;
          if (res.failedCount === 0) {
            this.toastrService.success(
              `Imported ${res.successCount} device(s)`,
              'Import complete',
            );
          } else {
            this.toastrService.warning(
              `Imported ${res.successCount} of ${res.successCount + res.failedCount} — ${res.failedCount} failed`,
              'Import finished with errors',
            );
          }
          this.displayBulkUploads();
        },
        error: (err) => {
          this.previewBusy = false;
          this.toastrService.error(
            err?.error?.message ?? err?.message ?? 'Import failed',
            'Import failed',
          );
        },
      });
  }

  discardPreview() {
    if (!this.previewBulkUploadId || this.previewBusy) return;
    if (!confirm('Discard this upload? The parsed rows will be thrown away.')) return;
    this.previewBusy = true;
    this.bulkUploadService
      .discardBulkUpload(this.previewBulkUploadId)
      .subscribe({
        next: () => {
          this.previewBusy = false;
          this.showPreview = false;
          this.previewBulkUploadId = null;
          this.toastrService.info('Upload discarded', 'Discarded');
          this.displayBulkUploads();
        },
        error: (err) => {
          this.previewBusy = false;
          this.toastrService.error(
            err?.error?.message ?? err?.message ?? 'Discard failed',
            'Discard failed',
          );
        },
      });
  }

  getBulkUploadLogs(bulkUploadId: number, organizationId: number) {
    this.bulkUploadService
      .getBulkUploadLogs(bulkUploadId, organizationId)
      .subscribe({
        next: (response) => {
          try {
            const errorDetails = response.details.log.errorDetails;
            if (errorDetails && errorDetails.length > 0) {
              this.showBulkUploadLogs = true;
              this.data = errorDetails;
              this.dataSource1 = new MatTableDataSource(this.data);
            }
          } catch (error) {
            this.showBulkUploadLogs = true;
            this.data = ['No logs'];
            this.dataSource1 = new MatTableDataSource(this.data);
          }
        },
      });
  }

  UpdateDevice(externalId: any) {
    this.deviceService.getDeviceInfoBYexternalId(externalId).subscribe(
      (data) => {
        if (data) {
          this.router.navigate(['/device/edit/' + externalId], {
            queryParams: { frombulk: true },
          });
        } else {
          this.toastrService.error(
            'device id has been updated',
            'current external id not found!!',
          );
        }
      },
      (error) => {
        //Error callback
        console.error('error caught in component', error);
        this.toastrService.error(
          'device id has been updated',
          'current external id not found!!',
        );
      },
    );
  }
}
