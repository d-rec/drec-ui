import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { AdminService, OrganizationService } from '../../../auth/services';
import { ToastrService } from 'ngx-toastr';
import { OrganizationInformation } from '../../../models';
import { Observable } from 'rxjs';
import { BulkUploadService } from '../../../auth/services/bulk-upload.service';
import { BulkUploadType } from '../../../utils/enums/bulk-upload-type.enum';
import { OrganizationType } from '../../../utils/enums/organization-types.enum';

@Component({
  selector: 'app-add-bulk-reads',
  templateUrl: './add-bulk-reads.component.html',
})
export class AddBulkReadsComponent implements OnInit {
  currentFile?: File | null;
  fileName = 'Please click here to select file';
  fileInfos?: Observable<any>;
  pageSize: number = 10;
  showBulkUploadLogs: boolean = false;
  bulkUploadColumns = [
    'serialNo',
    'createdAt',
    'jobId',
    'fileId',
    'status',
    'actions',
  ];
  bulkUploadLogsColumn = ['error'];

  constructor(
    private toasterService: ToastrService,
    private adminService: AdminService,
    private orgService: OrganizationService,
    private bulkUploadService: BulkUploadService,
  ) {
    this.loggedInUser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  dataSource1: MatTableDataSource<any>;
  data: any;
  organizationList: any;
  filteredOrganizationsList: OrganizationInformation[] = [];
  organizationName: string;
  organizationId: number;
  loggedInUser: any;
  ngOnInit(): void {
    if (this.loggedInUser.role === OrganizationType.Admin) {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.organizationList = data.organizations.filter(
          (org: OrganizationInformation) =>
            org.organizationType !== OrganizationType.Buyer,
        );
        this.filteredOrganizationsList = this.organizationList;
      });
    } else if (this.loggedInUser.role === OrganizationType.ApiUser) {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.organizationList = data.organizations.filter(
          (org) => org.organizationType != OrganizationType.Buyer,
        );
        this.filteredOrganizationsList = this.organizationList;
      });
    }
    this.displayBulkUploads();
  }

  filterOrgList() {
    this.filteredOrganizationsList = this.organizationList.filter(
      (org: OrganizationInformation) => {
        return org.name
          .toLowerCase()
          .includes(this.organizationName.toLowerCase());
      },
    );
  }

  selectOrg(event: any) {
    const selectedOrganization = this.organizationList.find(
      (option: any) => option.name === event.option.value,
    );
    if (selectedOrganization) {
      this.organizationId = selectedOrganization.id;
    }
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

  displayBulkUploads() {
    this.showBulkUploadLogs = false;
    this.bulkUploadService.getBulkUploads().subscribe((data) => {
      this.data = data;
      this.dataSource = new MatTableDataSource(this.data.bulkUploadJobs);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }

  getBulkUploadLogs(bulkUploadId: number, organizationId: number) {
    this.bulkUploadService
      .getBulkUploadLogs(bulkUploadId, organizationId)
      .subscribe({
        next: (response) => {
          try {
            const errorDetails = response.details;
            if (errorDetails && errorDetails.length > 0) {
              this.showBulkUploadLogs = true;
              this.data = [errorDetails];
              this.dataSource1 = new MatTableDataSource(this.data);
              this.dataSource1.paginator = this.paginator;
            }
          } catch (error) {
            this.showBulkUploadLogs = true;
            this.data = ['No logs'];
            this.dataSource1 = new MatTableDataSource(this.data);
            this.dataSource1.paginator = this.paginator;
          }
        },
      });
  }

  reset() {
    this.currentFile = null;
    this.fileName = 'Please click here to select file';
  }

  openFileExplorer() {
    document.getElementById('fileInput')?.click();
  }

  async downloadFile() {
    try {
      await this.bulkUploadService.downloadFile();
      this.toasterService.success('File downloaded successfully');
    } catch (error) {
      this.toasterService.error('Failed to download file');
    }
  }

  upload(): void {
    if (this.currentFile) {
      const organizationId = this.organizationId ?? this.loggedInUser.id;
      this.bulkUploadService
        .bulkUpload(this.currentFile, organizationId, BulkUploadType.Reads)
        .subscribe({
          next: () => {
            this.displayBulkUploads();
            this.currentFile = null;
            this.fileName = 'Please click here to Select File';
            this.toasterService.success(
              'Successfully!',
              'File Uploaded in Bulk!!',
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
