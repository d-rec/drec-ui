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
  loading: boolean = true;
  displayedColumns = [
    'serialNo',
    'createdAt',
    'jobId',
    'fileId',
    'status',
    'actions',
  ];
  constructor(
    private toasterService: ToastrService,
    private readsService: MeterReadService,
  ) {}
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;

  ngOnInit(): void {}

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
