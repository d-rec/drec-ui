import { Component, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { FileuploadService } from '../../../auth/services/fileupload.service';
import { ToastrService } from 'ngx-toastr';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
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
    'externalId',
    'errorsList',
    'Status',
    'Action',
  ];
  constructor(
    private uploadService: FileuploadService,
    private deviceService: DeviceService,
    private router: Router,
    private toastrService: ToastrService,
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
  orglist: any;
  filteredOrgList: OrganizationInformation[] = [];
  //public color: ThemePalette = 'primary';
  orgname: string;
  organizationId: number;
  loggedInUser: any;

  ngOnInit(): void {
    if (this.loggedInUser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType !== 'Buyer',
        );
        this.filteredOrgList = this.orglist;
      });
    } else if (this.loggedInUser.role === 'ApiUser') {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org) => org.organizationType != 'Buyer',
        );
        this.filteredOrgList = this.orglist;
      });
    }
    this.displayBulkUploads();
  }

  filterOrgList() {
    this.filteredOrgList = this.orglist.filter(
      (org: OrganizationInformation) => {
        return org.name.toLowerCase().includes(this.orgname.toLowerCase());
      },
    );
  }
  selectOrg(event: any) {
    const selectedCountry = this.orglist.find(
      (option: any) => option.name === event.option.value,
    );
    if (selectedCountry) {
      this.organizationId = selectedCountry.id;
    }
  }
  reset() {
    this.currentFile = null;
    this.fileName = 'Please click here to select file';
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

  openFileExplorer() {
    document.getElementById('fileInput')?.click();
  }

  async downloadFile() {
    try {
      await this.bulkUploadService.downloadFile(BulkUploadType.Devices);
      this.toastrService.success('File downloaded successfully');
    } catch (error) {
      this.toastrService.error('Failed to download file');
    }
  }

  upload(): void {
    if (this.currentFile) {
      const organizationId = this.organizationId ?? this.loggedInUser.id;
      this.bulkUploadService
        .bulkUpload(this.currentFile, organizationId, BulkUploadType.Devices)
        .subscribe({
          next: () => {
            this.displayBulkUploads();
            this.currentFile = null;
            this.fileName = 'Please click here to Select File';
            this.toastrService.success(
              'Successfully!',
              'File Uploaded in Bulk!!',
            );
          },
          error: (err) => {
            if (err.error.statusCode === 403) {
              this.toastrService.error('You are Unauthorized');
            } else {
              this.toastrService.error('error!', err.error.message);
            }
          },
        });
    }
  }

  displayBulkUploads() {
    this.showBulkUploadLogs = false;
    const organizationId = this.organizationId ?? this.loggedInUser.id;
    this.bulkUploadService
      .getBulkUploads(organizationId, BulkUploadType.Devices)
      .subscribe((data) => {
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
            const errorDetails = response.details.log.errorDetails;
            if (errorDetails && errorDetails.length > 0) {
              this.showBulkUploadLogs = true;
              this.data = errorDetails;
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
