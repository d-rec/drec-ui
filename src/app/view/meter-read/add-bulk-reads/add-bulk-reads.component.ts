import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MeterReadService } from '../../../auth/services';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-add-bulk-reads',
  templateUrl: './add-bulk-reads.component.html',
})
export class AddBulkReadsComponent implements OnInit {
  currentFile?: File | null;
  fileName = 'Please click here to select file';
  pageSize: number = 10;
  showReadsInfo: boolean = false;
  readsStatusList: any = [];
  loading: boolean = true;
  objectKeys = Object.keys;
  displayedColumns = [
    'serialNo',
    'createdAt',
    'jobId',
    'fileId',
    'status',
    'actions',
  ];
  displayedColumns1 = [
    'serialNo',
    'externalId',
    'errorsList',
    'Status',
    'Action',
  ];
  constructor(
    private toasterService: ToastrService,
    private readsService: MeterReadService,
  ) {}
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  dataSource1: MatTableDataSource<any>;
  data: any;
  ngOnInit(): void {
    this.readsJobDisplayList();
  }

  selectFile(event: any): void {
    if (event.target.files && event.target.files[0]) {
      const file: File = event.target.files[0];
      this.currentFile = file;
      this.fileName = this.currentFile.name;
      if (!this.fileName.endsWith('.csv')) {
        this.fileName = 'Invalid file';
        this.currentFile = null;
      }
    } else {
      this.fileName = 'Please click here to select file';
    }
    event.target.value = '';
  }

  readsJobDisplayList() {
    this.showReadsInfo = false;
    this.loading = true;
    this.readsService.getCsvJobList().subscribe((data) => {
      this.loading = false;
      this.data = data;
      this.dataSource = new MatTableDataSource(this.data.csvJobs);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }

  displayReadsLogList(jobId: number, orgId: number) {
    this.showReadsInfo = true;
    this.readsStatusList = [];
    this.readsService.getJobStatus(jobId, orgId).subscribe((data) => {
      this.data = data.errorDetails.log.errorDetails;
      this.dataSource1 = new MatTableDataSource(this.data);
      this.dataSource1.paginator = this.paginator;
    });
  }

  reset() {
    this.currentFile = null;
    this.fileName = 'Please click here to select file';
  }

  openFileExplorer() {
    document.getElementById('fileInput')?.click();
  }

  upload(): void {
    if (this.currentFile) {
      this.readsService.readsCSVUpload(this.currentFile).subscribe({
        next: () => {
          this.readsJobDisplayList();
          this.currentFile = null;
          this.fileName = 'Please click here to Select File';
          this.toasterService.success(
            'Successfully!',
            'Devices Uploaded in Bulk!!',
          );
        },
        error: (err) => {
          if (err.error.statusCode === 403) {
            this.toasterService.error('You are Unauthorized');
          } else {
            this.toasterService.error('error!', err.error.message);
          }
        },
      });
    }
  }
}
