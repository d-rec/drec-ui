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
  showdevicesinfo: boolean = false;
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
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
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
  orgId: number;
  loginuser: any;

  ngOnInit(): void {
    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType !== 'Buyer',
        );
        this.filteredOrgList = this.orglist;
      });
    } else if (this.loginuser.role === 'ApiUser') {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org) => org.organizationType != 'Buyer',
        );
        this.filteredOrgList = this.orglist;
      });
    }
    this.JobDisplayList();
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
      this.orgId = selectedCountry.id;
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

  upload(): void {
    this.progress = 0;
    this.message = '';

    if (this.currentFile) {
      this.uploadService.csvupload(this.currentFile).subscribe(
        (event: any) => {
          const obj: any = {};
          obj['fileName'] = event[0];
          if (
            this.loginuser.role === 'Admin' ||
            this.loginuser.role === 'ApiUser'
          ) {
            this.deviceService
              .addByAdminbulkDevices(this.orgId, obj)
              .subscribe({
                next: () => {
                  this.JobDisplayList();
                  this.currentFile = null;
                  this.fileName = 'Please click here to Select File';
                  this.toastrService.success(
                    'Successfully!',
                    'Devices Uploaded in Bulk!!',
                  );
                },
                error: (err) => {
                  //Error callback
                  console.error('error caught in component', err);
                  if (err.error.statusCode === 403) {
                    this.toastrService.error(
                      "You don't have the permissions to add devices.",
                      'Access Denied',
                    );
                  } else {
                    this.toastrService.error('error!', err.error.message);
                  }
                },
              });
          } else {
            this.uploadService.addbulkDevices(obj).subscribe({
              next: () => {
                this.JobDisplayList();
                this.currentFile = null;
                this.fileName = 'Please click here to Select File';
                this.toastrService.success(
                  'Successful',
                  'Devices uploaded in bulk',
                );
              },
              error: (err) => {
                //Error callback
                console.error('error caught in component', err);
                if (err.error.statusCode === 403) {
                  this.toastrService.error(
                    "You don't have the permissions to add  devices.",
                    'Access Denied',
                  );
                } else {
                  this.toastrService.error('error!', err.error.message);
                }
              },
            });
          }
        },
        (err: any) => {
          this.progress = 0;

          if (err.error && err.error.message) {
            this.message = err.error.message;
          } else {
            this.message = 'Could not upload the file!';
          }

          this.currentFile = null;
        },
      );
    }
  }
  JobDisplayList() {
    this.showdevicesinfo = false;
    this.loading = true;
    this.uploadService.getCsvJobList().subscribe((data) => {
      // display list in the console
      this.loading = false;
      this.data = data;
      this.dataSource = new MatTableDataSource(this.data.csvJobs);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }
  DisplayDeviceLogList(jobid: number, orgId: number) {
    this.showdevicesinfo = true;
    this.DevicestatusList = [];
    this.uploadService.getJobStatus(jobid, orgId).subscribe((data) => {
      this.data = data.errorDetails.log.errorDetails;
      this.dataSource1 = new MatTableDataSource(this.data);
      this.dataSource1.paginator = this.paginator;
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
