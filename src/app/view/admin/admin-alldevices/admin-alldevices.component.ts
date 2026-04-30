import { FormBuilder, FormGroup } from '@angular/forms';
import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { AuthbaseService } from '../../../auth/authbase.service';
import { DeviceService, AdminService } from '../../../auth/services';
import { Router } from '@angular/router';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { DeviceDetailsComponent } from '../../device/device-details/device-details.component';
import { ToastrService } from 'ngx-toastr';
import {
  OrganizationInformation,
  fulecodeType,
  devicecodeType,
  CountryInfo,
} from '../../../models';
import {
  MapComponent,
  satellitePreview,
  SatellitePreview,
} from '../../map/map.component';
@Component({
  standalone: false,
  selector: 'app-admin-alldevices',
  templateUrl: './admin-alldevices.component.html',
  styleUrls: ['./admin-alldevices.component.scss'],
})
export class AdminAlldevicesComponent {
  title = 'matDialog';
  dataFromDialog: any;
  displayedColumns = [
    'rowIndex',
    'siteName',
    'organization',
    'developerExternalId',
    'externalId',
    'countryCode',
    'capacity',
    'reviewStatus',
    'IREC_Status',
    'IREC_ID',
    'actions',
  ];
  satPreviewEnabled = true;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  private _sort: MatSort;
  @ViewChild(MatSort) set sort(s: MatSort) {
    this._sort = s;
    if (this.dataSource) {
      this.dataSource.sort = s;
    }
  }
  @ViewChild('mapComponent') mapComponent: MapComponent;
  dataSource: MatTableDataSource<any>;
  data: any;
  searchText: string = '';
  satPreview: {
    lat: number;
    lng: number;
    label: string;
    x: number;
    y: number;
  } | null = null;
  loginuser: any;
  deviceurl: any;
  pageSize: number = 20;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  devicetypelist: devicecodeType[] = [];
  fuellistLoaded: boolean = false;
  devicetypeLoded: boolean = false;
  countrycodeLoded: boolean = false;
  loading: boolean = true;
  public sdgblist: any;
  FilterForm: FormGroup;
  p: number = 1;
  totalRows = 0;
  filteredOptions: Observable<any[]>;
  filteredOptions1: Observable<any[]>;
  offtaker = [
    'School',
    'Education',
    'Health Facility',
    'Residential',
    'Commercial',
    'Industrial',
    'Public Sector',
    'Agriculture',
    'Utility',
    'Off-Grid Community',
  ];
  endminDate = new Date();
  totalPages: number;
  subscription: Subscription;
  selectedCountry: any;
  isAnyFieldFilled: boolean = false;
  showerror: boolean = false;
  showorgerror: boolean = false;
  showlist: boolean = false;
  orglist: OrganizationInformation[] = [];
  showregistrant_devices: boolean = false;
  registrantId: string;
  hideMap: boolean = false;
  hideFilterDevices: boolean = true;
  showResetMapFilter: boolean = false;
  selectedExternalId: string | null = null;
  constructor(
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private adminService: AdminService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private toastrService: ToastrService,
    private changeDetectorRef: ChangeDetectorRef,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.registrantId = sessionStorage.getItem('registrantId')!;
    this.FilterForm = this.formBuilder.group({
      organizationname: [],
      organizationId: [],
      countryCode: [],
      countryname: [],
      fuelCode: [],
      deviceTypeCode: [],
      capacity: [],
      offTaker: [],
      SDGBenefits: [],
      start_date: [null],
      end_date: [null],
    });
  }
  ngOnInit(): void {
    if (this.loginuser.role === 'Registrant') {
      this.showregistrant_devices = true;
    }

    this.adminService.GetAllOrganization().subscribe((data) => {
      this.orglist = data.organizations.filter(
        (org: OrganizationInformation) => org.organizationType !== 'Buyer',
      );
      this.applyOrganizationFilter();
      this.loading = false;
    });

    this.authService.GetMethod('device/fuel-type').subscribe((data1: any) => {
      this.fuellist = data1;
      this.fuellistLoaded = true;
    });

    this.authService.GetMethod('device/device-type').subscribe((data2: any) => {
      this.devicetypelist = data2;
      this.devicetypeLoded = true;
    });

    this.authService.GetMethod('countrycode/list').subscribe((data3: any) => {
      this.countrylist = data3;
      this.applyCountryFilter();
      this.countrycodeLoded = true;
    });

    this.authService.GetMethod('sdgbenefit/code').subscribe((data) => {
      this.sdgblist = data;
    });

    this.getDeviceListData(this.p);
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  applyOrganizationFilter() {
    this.filteredOptions1 = this.FilterForm.controls[
      'organizationname'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._orgfilter(value || '')),
    );
  }
  private _orgfilter(value: any): OrganizationInformation[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.orglist.filter((option: any) =>
          option.name.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      this.showorgerror = true;
    } else {
      this.showorgerror = false;
    }
    return this.orglist.filter(
      (option: any) =>
        option.name.toLowerCase().indexOf(filterValue.toLowerCase()) === 0,
    );
  }
  applyCountryFilter() {
    const countryInput = this.FilterForm.get('countryname');

    if (!countryInput) return;

    this.filteredOptions = countryInput.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '')),
    );
  }

  private _filter(value: any): CountryInfo[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.countrylist.filter((option: any) =>
          option.country.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      this.showerror = true;
      // const updatedFormValues = this.FilterForm.value;
      // const isAllValuesNull = Object.values(this.FilterForm.value).some((value) => !!value);
      // this.isAnyFieldFilled = false;
    } else {
      this.showerror = false;
    }
    return this.countrylist.filter(
      (option: any) =>
        option.country.toLowerCase().indexOf(filterValue.toLowerCase()) === 0,
    );
  }

  checkFormValidity(): void {
    const isUserInteraction = true; // Flag to track user interaction

    this.FilterForm.valueChanges
      .pipe(
        debounceTime(500), // Debounce the stream for 500 milliseconds
      )
      .subscribe((formValues) => {
        if (isUserInteraction) {
          if (
            formValues.organizationId === undefined ||
            formValues.organizationId === ''
          ) {
            this.FilterForm.controls['organizationname'].setValue(null);
            this.FilterForm.controls['organizationId'].setValue(null);
          }
          const countryValue = formValues.countryname;
          if (countryValue === undefined || countryValue === '') {
            this.FilterForm.controls['countryname'].setValue(null);
            this.FilterForm.controls['countryCode'].setValue(null);
          }
          const fuelCodeValue = formValues.fuelCode;
          if (fuelCodeValue === undefined) {
            this.FilterForm.controls['fuelCode'].setValue(null);
          }
          if (
            formValues.offTaker != null &&
            formValues.offTaker[0] === undefined
          ) {
            this.FilterForm.controls['offTaker'].setValue(null);
          }
          if (
            formValues.deviceTypeCode != null &&
            formValues.deviceTypeCode[0] === undefined
          ) {
            this.FilterForm.controls['deviceTypeCode'].setValue(null);
          }
          if (
            formValues.SDGBenefits != null &&
            formValues.SDGBenefits[0] === undefined
          ) {
            this.FilterForm.controls['SDGBenefits'].setValue(null);
          }
          // Other code...
        }
      });

    setTimeout(() => {
      const updatedFormValues = this.FilterForm.value;
      const isAllValuesNull = Object.values(updatedFormValues).some(
        (value) => !!value,
      );
      this.isAnyFieldFilled = isAllValuesNull;
      if (!this.isAnyFieldFilled) {
        this.getDeviceListData(this.p);
      }
    }, 500);

    // Other code...
  }
  selectCountry(event: any) {
    this.subscription = this.filteredOptions.subscribe((options) => {
      const selectedCountry = options.find(
        (option) => option.country === event.option.value,
      );
      if (selectedCountry) {
        this.FilterForm.controls['countryCode'].setValue(
          selectedCountry.alpha3,
        );
      }
    });
  }
  selectorg(event: any) {
    this.subscription = this.filteredOptions1.subscribe((options) => {
      const selectedorg = options.find(
        (option) => option.name === event.option.value,
      );
      if (selectedorg) {
        this.FilterForm.controls['organizationId'].setValue(selectedorg.id);
      }
    });
  }

  reset() {
    this.FilterForm.reset();
    this.FilterForm.controls['countryCode'].setValue(null);
    this.loading = false;
    this.isAnyFieldFilled = false;
    this.p = 1;
    this.getDeviceListData(this.p);
  }

  onEndChangeEvent(event: any) {
    this.endminDate = event;
  }

  DisplayListFilter() {
    this.p = 1;
    this.getDeviceListData(this.p);
  }
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
  clearSearch() {
    this.searchText = '';
    this.selectedExternalId = null;
    if (this.dataSource) {
      this.dataSource.filter = '';
    }
  }
  getDeviceListData(page: number) {
    this.deviceurl = 'device?limit=10000&';

    this.deviceService
      .GetMyDevices(this.deviceurl, this.FilterForm.value, page)
      .subscribe({
        next: (data) => {
          this.showlist = true;

          if (data.devices) {
            this.loading = false;

            this.data = data;
            this.DisplayList();
          }
        },
        error: (err) => {
          if (err.error.statusCode === 403) {
            this.toastrService.error('You are Unauthorized');
          }
          this.data = [];
          this.showlist = false;
        },
      });
  }

  DisplayList() {
    if (
      this.fuellistLoaded == true &&
      this.devicetypeLoded == true &&
      this.countrycodeLoded === true
    ) {
      this.data.devices.forEach((ele: any) => {
        ele['fuelname'] = this.fuellist.find(
          (fuelType) => fuelType.code === ele.fuelCode,
        )?.name;

        ele['devicetypename'] = this.devicetypelist.find(
          (devicetype) => devicetype.code == ele.deviceTypeCode,
        )?.name;

        ele['countryname'] = this.countrylist.find(
          (countrycode) => countrycode.alpha3 == ele.countryCode,
        )?.country;
      });

      this.dataSource = new MatTableDataSource(this.data.devices);
      this.totalRows = this.data.totalCount;
      this.totalPages = this.data.totalPages;
      // this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this._sort;

      // Use setTimeout to ensure the map component is fully initialized
      setTimeout(() => {
        this.updateMapMarkers(this.data.devices);
      }, 300);
    }
  }
  UpdateDevice(externalId: any) {
    this.router.navigate(['/device/edit/' + externalId], {
      queryParams: { fromdevices: true },
    });
  }
  // pageChangeEvent(event: PageEvent) {
  //   this.p = event.pageIndex + 1;
  //   this.getDeviceListData();
  // }

  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      this.getDeviceListData(this.p);
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      this.getDeviceListData(this.p);
    }
  }

  alertDialog(deviceId: number): void {
    this.dialog.open(DeviceDetailsComponent, {
      data: {
        deviceid: deviceId,
      },
      width: '900px',
      height: '70vh',
    });
  }

  DeviceregistationI_REC(deviceid: number) {
    this.adminService.AddIrecDevice(deviceid).subscribe({
      next: (data: any) => {
        if (data.status) {
          this.toastrService.success(data.message, 'I-REC ID-' + data.IREC_ID);
          this.getDeviceListData(this.p);
        } else {
          this.toastrService.warning('Failure', data.message);
        }
      },
      error: (err) => {
        this.toastrService.error('Failure', err);
      },
    });
  }

  toggleMap() {
    this.hideMap = !this.hideMap;

    // If we're showing the map and we have data, reapply the markers
    if (!this.hideMap && this.data && this.data.devices) {
      // Use setTimeout to ensure the map component is fully initialized after toggling
      setTimeout(() => {
        this.updateMapMarkers(this.data.devices);
      }, 300);
    }
  }

  toggleFilterDevices() {
    this.hideFilterDevices = !this.hideFilterDevices;
  }

  updateMapMarkers(devices: any[]) {
    if (this.mapComponent && devices) {
      const validDevices = devices.filter(
        (device) =>
          device.latitude &&
          device.longitude &&
          !isNaN(parseFloat(device.latitude)) &&
          !isNaN(parseFloat(device.longitude)),
      );

      if (validDevices.length === 0) {
        return;
      }

      const markers = validDevices.map((device) => ({
        latitude: parseFloat(device.latitude),
        longitude: parseFloat(device.longitude),
        externalId: device.externalId || '',
        siteName: device.siteName || '',
        device,
      }));

      // Set the markers on the map component
      this.mapComponent.markers = [...markers];

      // If the map is already initialized, update it directly
      if (this.mapComponent.isMapInitialized) {
        this.mapComponent.update();
      }
    }
  }

  onMarkerClick(event: { externalId: string }) {
    this.showResetMapFilter = true;
    this.selectedExternalId = event.externalId;
    this.dataSource.filter = event.externalId.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    this.changeDetectorRef.detectChanges();
  }

  resetMapFilter() {
    this.selectedExternalId = null;
    this.dataSource.filter = '';
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    this.showResetMapFilter = false;
    this.changeDetectorRef.detectChanges();
  }

  showSatPreview(event: MouseEvent, row: any) {
    if (!this.satPreviewEnabled) return;
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    if (isNaN(lat) || isNaN(lng)) return;
    const pos = this.satPreviewPos(event);
    this.satPreview = {
      lat,
      lng,
      label: row.siteName || row.externalId || '',
      x: pos.x,
      y: pos.y,
    };
  }

  moveSatPreview(event: MouseEvent) {
    if (!this.satPreview) return;
    const pos = this.satPreviewPos(event);
    this.satPreview = { ...this.satPreview, x: pos.x, y: pos.y };
  }

  private satPreviewPos(event: MouseEvent): { x: number; y: number } {
    const boxW = 270;
    const boxH = 290;
    const gap = 16;
    const rightFits = event.clientX + gap + boxW < window.innerWidth;
    const x = rightFits ? event.clientX + gap : event.clientX - gap - boxW;
    const y = Math.min(
      Math.max(event.clientY - boxH / 2, 4),
      window.innerHeight - boxH - 4,
    );
    return { x, y };
  }

  hideSatPreview() {
    this.satPreview = null;
  }
}
