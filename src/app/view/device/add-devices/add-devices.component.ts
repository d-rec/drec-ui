import {
  Component,
  TemplateRef,
  ViewChild,
  EventEmitter,
  Output,
} from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  FormArray,
  Validators,
  FormControl,
} from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import {
  DeviceService,
  AdminService,
  OrganizationService,
} from '../../../auth/services';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import {
  OrganizationInformation,
  fulecodeType,
  devicecodeType,
  CountryInfo,
} from '../../../models';
import { postcodeValidator } from '../../../utils/validate-postcode';
import { MatDialog } from '@angular/material/dialog';
import {
  DocumentType,
  DataSourceTypes,
  OrganizationType,
} from '../../../utils/drec.enum';
import { MapComponent } from '../../map/map.component';
import {
  validateAndAppendFiles,
  shortenFileName,
} from '../../../utils/file-upload.helper';
import { DOCUMENTS_EXTENSIONS } from '../../../constants/documents-extensions';

export type DeviceFiles = {
  [DocumentType.FORM_SF_02]: File[];
  [DocumentType.SF_02C]: File[];
  [DocumentType.METERING_EVIDENCE]: File[];
  [DocumentType.SINGLE_LINE_DIAGRAM]: File[];
  [DocumentType.PROJECT_PHOTOS]: File[];
  [DocumentType.COD_PROOF]: File[];
};
type FileType = keyof DeviceFiles;

@Component({
  standalone: false,
  selector: 'app-add-devices',
  templateUrl: './add-devices.component.html',
  styleUrls: ['./add-devices.component.scss'],
})
export class AddDevicesComponent {
  @ViewChild('popupDialog') popupDialog = {} as TemplateRef<any>;
  DataSourceTypes = DataSourceTypes;
  DocumentType = DocumentType;
  dialogRef: any;
  user: any;
  myform: FormGroup;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  devicetypelist: devicecodeType[] = [];
  hide = true;
  addmoredetals: any[] = [];
  shownomore: any[] = [];
  showaddmore: any[] = [];
  showerror: any[] = [];
  maxDate = new Date();
  public date: any;
  public sdgblist: any;
  public disabled = false;
  public showSpinners = true;
  public showSeconds = false;
  public touchUi = false;
  public enableMeridian = false;
  organizationList: OrganizationInformation[] = [];
  currentOrganization: OrganizationInformation | undefined;

  public stepHour = 1;
  public stepMinute = 1;
  public stepSecond = 1;
  numberregex: RegExp = /^-?[0-9]+(\.[0-9]*)?$/;
  serialNumberRegex: RegExp = /^[a-zA-Z0-9_-]+$/;
  filteredCountryList: Observable<any[]>[] = [];
  subscription: Subscription;
  filteredOrganizationList: OrganizationInformation[] = [];
  organizationName: string;
  organizationId: number;
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
  devicedescription = [
    'Solar Lantern',
    'Solar Home System',
    'Mini Grid',
    'Rooftop Solar',
    'Ground Mount Solar',
  ];
  files: {
    [index: number]: DeviceFiles;
  } = {};
  allDocumentsUploaded: boolean = false;
  formValid: boolean = false;
  isSubmitting: boolean = false;
  submitButtonText: string = 'Submit';
  requiredFileTypes: FileType[] = [
    DocumentType.FORM_SF_02,
    DocumentType.SF_02C,
    DocumentType.METERING_EVIDENCE,
    DocumentType.SINGLE_LINE_DIAGRAM,
    DocumentType.PROJECT_PHOTOS,
    DocumentType.COD_PROOF,
  ];
  @ViewChild(MapComponent) mapComponent: MapComponent;
  @Output() zoom = new EventEmitter<number>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private router: Router,
    private toastrService: ToastrService,
    private adminService: AdminService,
    private orgService: OrganizationService,
    public dialog: MatDialog,
  ) {
    this.user = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {
    this.loadData();
    this.initializeForm();
    this.showinput[0] = true;
    this.addmoredetals[0] = false;
    this.showaddmore[0] = true;
    this.showerror[0] = false;
    this.shownomore[0] = false;

    setTimeout(() => {
      this.setupCountryAutocomplete(0);
    }, 1500);
    this.deviceForms.controls.forEach((group) => {
      this.setupdataSourceBrandWatcher(group as FormGroup);
      this.setupDataSourceWatcher(group as FormGroup);
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private fetchOrganizationList() {
    this.orgService.getOrganizationInformation().subscribe((data) => {
      this.currentOrganization = data;
      if (
        ![OrganizationType.ApiUser, OrganizationType.Admin].includes(
          this.user.role,
        )
      ) {
        this.organizationName = this.currentOrganization?.name;
        this.organizationId = this.currentOrganization?.id;
      }
    });
  }

  private loadData() {
    this.fetchOrganizationList();
    if (this.user.role === OrganizationType.Admin) {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.organizationList = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType !== 'Buyer',
        );
        this.filteredOrganizationList = this.organizationList;
        this.date = new Date();
      });
    } else if (this.user.role === OrganizationType.ApiUser) {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.organizationList = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType === 'Developer',
        );
        this.filteredOrganizationList = this.organizationList;
      });
    }

    this.DisplayList();
    this.DisplaySDGBList();
    this.DisplayfuelList();
    this.DisplaytypeList();
  }

  filterOrgList() {
    this.filteredOrganizationList = this.organizationList.filter((org: any) => {
      return org.name
        .toLowerCase()
        .includes(this.organizationName.toLowerCase());
    });
  }

  selectOrg(event: any) {
    const selectedOrganization = this.organizationList.find(
      (option) => option.name === event.option.value,
    );
    if (selectedOrganization) {
      this.organizationId = selectedOrganization.id;
    }
  }

  private initializeForm() {
    this.myform = this.fb.group({
      devices: this.fb.array([]),
    });
    this.myform.valueChanges.subscribe();

    const device = this.fb.group({
      projectName: [null],
      dataSource: [null, [Validators.required]],
      serialNumber: [
        { value: null, disabled: true },
        Validators.pattern(this.serialNumberRegex),
      ],
      otherDataSource: [''],
      address: [null, [Validators.required]],
      dataSourceBrand: [{ value: '', disabled: true }],
      latitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      longitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      countryCodename: [null, Validators.required],
      fuelCode: [null, [Validators.required]],
      deviceTypeCode: [null, [Validators.required]],
      capacity: [null, Validators.required],
      acCapacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: [true],
      offTaker: [null],
      impactStory: [null],
      data: [null],
      images: [null],
      deviceDescription: [null],
      energyStorage: [true],
      energyStorageCapacity: [null],
      stateProvince: [null],
      qualityLabels: [null],
      SDGBenefits: [[new FormControl([])]],
      version: ['1.0'],
      postcode: [null, [postcodeValidator()]],
      FORM_SF_02: [null, [Validators.required]],
      SF_02C: [null, [Validators.required]],
      METERING_EVIDENCE: [null, [Validators.required]],
      SINGLE_LINE_DIAGRAM: [null, [Validators.required]],
      PROJECT_PHOTOS: [null, [Validators.required]],
      COD_PROOF: [null, [Validators.required]],
    });

    device.get('latitude')?.valueChanges.subscribe((latitude) => {
      const longitude = device.get('longitude')?.value;
      this.updateMapMarkers(latitude, longitude);
    });
    device.get('longitude')?.valueChanges.subscribe((longitude) => {
      const latitude = device.get('latitude')?.value;
      this.updateMapMarkers(latitude, longitude);
    });

    this.deviceForms.push(device);
    this.setupDataSourceWatcher(device);
  }

  private setupCountryAutocomplete(index: number) {
    this.filteredCountryList[index] = this.getCountryCodeControl(
      index,
    ).valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '', index)),
    );
  }

  get deviceForms() {
    return this.myform.get('devices') as FormArray;
  }

  DisplayList() {
    this.authService.GetMethod('countrycode/list').subscribe((data: any) => {
      this.countrylist = data;
    });
  }

  DisplaySDGBList() {
    this.authService.GetMethod('sdgbenefit/code').subscribe((data) => {
      this.sdgblist = data;
    });
  }

  DisplayfuelList() {
    this.authService.GetMethod('device/fuel-type').subscribe((data: any) => {
      this.fuellist = data;
    });
  }

  DisplaytypeList() {
    this.authService.GetMethod('device/device-type').subscribe((data: any) => {
      this.devicetypelist = data;
    });
  }

  onSDGBRemoved(topping: string, i: number) {
    const toppings: any = this.myform.get('devices') as FormArray;
    const sdgb = toppings[i].SDGBenefits.value as string[];
    this.removeFirst(sdgb, topping);
    toppings[i].SDGBenefits.setValue(sdgb);
  }

  private removeFirst<T>(array: T[], toRemove: T): void {
    const index = array.indexOf(toRemove);
    if (index !== -1) {
      array.splice(index, 1);
    }
  }

  adddevice() {
    const device = this.fb.group({
      dataSource: [null, [Validators.required]],
      dataSourceBrand: [{ value: '', disabled: true }],
      serialNumber: [null, Validators.pattern(this.serialNumberRegex)],
      otherDataSource: [''],
      projectName: [null],
      address: [null],
      latitude: [null, Validators.pattern(this.numberregex)],
      longitude: [null, Validators.pattern(this.numberregex)],
      countryCodename: [null, Validators.required],
      fuelCode: [null],
      deviceTypeCode: [null],
      capacity: [null, Validators.required],
      acCapacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: true,
      offTaker: [null],
      impactStory: [null],
      images: [null],
      deviceDescription: [null],
      energyStorage: true,
      energyStorageCapacity: [null],
      stateOrProvince: [null],
      qualityLabels: [null],
      SDGBenefits: [[new FormControl([])]],
      version: ['1.0'],
      postcode: [null, [postcodeValidator()]],
      FORM_SF_02: [null, [Validators.required]],
      SF_02C: [null, [Validators.required]],
      METERING_EVIDENCE: [null, [Validators.required]],
      SINGLE_LINE_DIAGRAM: [null, [Validators.required]],
      PROJECT_PHOTOS: [null, [Validators.required]],
      COD_PROOF: [null, [Validators.required]],
    });

    this.deviceForms.push(device);
    this.showaddmore[this.deviceForms.length - 1] = true;
    this.showinput[this.deviceForms.length - 1] = true;

    const index = this.deviceForms.length - 1;
    this.filteredCountryList[index] = this.getCountryCodeControl(
      index,
    ).valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '', index)),
    );

    this.setupDataSourceWatcher(device);
  }

  private setupDataSourceWatcher(deviceGroup: FormGroup) {
    const dataSource = deviceGroup.get('dataSource');
    const serialNumber = deviceGroup.get('serialNumber');
    const otherDataSource = deviceGroup.get('otherDataSource');

    dataSource?.valueChanges.subscribe((value) => {
      if (value) {
        serialNumber?.enable();
        serialNumber?.setValidators([Validators.required]);
      } else {
        serialNumber?.disable();
        serialNumber?.clearValidators();
        serialNumber?.reset();
      }
      serialNumber?.updateValueAndValidity();

      if (value === DataSourceTypes.Other) {
        otherDataSource?.setValidators([Validators.required]);
      } else {
        otherDataSource?.clearValidators();
        otherDataSource?.reset();
      }
      otherDataSource?.updateValueAndValidity();
    });
  }

  getSerialNumberLabel(index: number): string {
    const dataSource = this.deviceForms.at(index).get('dataSource')?.value;
    switch (dataSource) {
      case DataSourceTypes.Inverter:
        return 'Inverter Serial Number';
      case DataSourceTypes.DataLogger:
        return 'Data Logger Serial Number';
      case DataSourceTypes.Other:
        return 'Other Id';
      default:
        return 'Serial Number';
    }
  }
  private setupdataSourceBrandWatcher(deviceGroup: FormGroup) {
    const dataSource = deviceGroup.get('dataSource');
    const dataSourceBrand = deviceGroup.get('dataSourceBrand');

    dataSource?.valueChanges.subscribe((value) => {
      if (value) {
        dataSourceBrand?.enable();
        dataSourceBrand?.setValidators([Validators.required]);
      } else {
        dataSourceBrand?.disable();
        dataSourceBrand?.clearValidators();
        dataSourceBrand?.reset();
      }
      dataSourceBrand?.updateValueAndValidity();
    });
  }

  dataSourceBrandLabel(index: number): string {
    const dataSource = this.deviceForms.at(index).get('dataSource')?.value;
    switch (dataSource) {
      case DataSourceTypes.Inverter:
        return 'Inverter Brand Name';
      case DataSourceTypes.DataLogger:
        return 'Data Logger Brand Name';
      case DataSourceTypes.Other:
        return 'Data source Brand Name';
      default:
        return 'Data Source Brand Name';
    }
  }
  private _filter(value: string, i: number): CountryInfo[] {
    const filterValue = value?.toLowerCase() || '';

    if (!filterValue) {
      this.showerror[i] = false;
      return this.countrylist;
    }

    const filteredCountries = this.countrylist.filter((option: CountryInfo) =>
      option?.country?.toLowerCase().includes(filterValue),
    );

    this.showerror[i] = filteredCountries.length === 0;

    return filteredCountries;
  }

  addmore(i: number) {
    this.addmoredetals[i] = true;
    this.shownomore[i] = true;
    this.showaddmore[i] = false;
  }

  nomore(i: number) {
    this.addmoredetals[i] = false;
    this.showaddmore[i] = true;
    this.shownomore[i] = false;
  }

  showinput: any[] = [];
  showenergycapacity_input(i: number, event: any) {
    if (event) {
      this.showinput[i] = true;
    } else {
      this.showinput[i] = false;
    }
  }

  deleteDevice(i: number) {
    this.deviceForms.removeAt(i);
  }

  getCountryCodeControl(index: number): FormControl {
    return this.deviceForms.at(index).get('countryCodename') as FormControl;
  }

  checkDocumentsUploaded() {
    if (Object.keys(this.files).length === 0) {
      this.allDocumentsUploaded = false;
      this.formValid = false;
      return;
    }

    const allDocsUploaded = this.deviceForms.controls.every(
      (_, deviceIndex) => {
        if (!this.files[deviceIndex]) return false;
        return this.requiredFileTypes.every(
          (fileType) => this.files[deviceIndex][fileType]?.length > 0,
        );
      },
    );

    this.allDocumentsUploaded = allDocsUploaded;
    this.formValid = this.myform.valid && allDocsUploaded;
  }

  onFileChange(event: Event, deviceIndex: number, fileType: FileType) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files: FileList = input.files;

    if (!this.files[deviceIndex]) {
      this.files[deviceIndex] = this.requiredFileTypes.reduce(
        (acc, docType) => {
          acc[docType] = [];
          return acc;
        },
        {} as DeviceFiles,
      );
    }

    this.files[deviceIndex][fileType] = Array.from(files);

    const fileControl = this.deviceForms.at(deviceIndex).get(fileType);
    if (fileControl) {
      fileControl.setValue(input.files[0]);
      fileControl.markAsDirty();
    }
    this.checkDocumentsUploaded();
  }

  onSubmit() {
    this.myform.markAllAsTouched();
    if (!this.formValid) return;
    this.openPopupDialog();
    this.isSubmitting = true;
  }

  submitForm() {
    const deviceArray = this.myform.value.devices;
    deviceArray.forEach((element: any, index: number) => {
      const formData = new FormData();
      if (this.organizationName != null) {
        element['organizationId'] = this.organizationId;
      }
      const selectedCountry = this.countrylist.find(
        (option: CountryInfo) => option.country === element.countryCodename,
      );
      element['countryCode'] = selectedCountry?.alpha3;
      formData.append('deviceToRegister', JSON.stringify(element));
      if (element.countryCode) {
        formData.append('countryCode', element.countryCode);
      } else {
        console.error('Country code is missing for device:', element);
      }

      const fileFields: FileType[] = [
        DocumentType.FORM_SF_02,
        DocumentType.SF_02C,
        DocumentType.METERING_EVIDENCE,
        DocumentType.SINGLE_LINE_DIAGRAM,
        DocumentType.PROJECT_PHOTOS,
        DocumentType.COD_PROOF,
      ];

      const allowedExtensions = [...DOCUMENTS_EXTENSIONS];
      const maxSizeInMB = 20;

      let allErrors: Record<string, string[]> = {};

      fileFields.forEach((fileType: FileType) => {
        const files = this.files[index]?.[fileType];
        if (files?.length) {
          const { errors } = validateAndAppendFiles(
            formData,
            files,
            fileType,
            allowedExtensions,
            maxSizeInMB,
            this.toastrService,
          );

          if (Object.keys(errors).length > 0) {
            allErrors = { ...allErrors, ...errors };
          }
        }
      });

      if (Object.keys(allErrors).length > 0) {
        console.error(
          'One or more files are invalid. Request will not be sent.',
          allErrors,
        );
        this.submitButtonText = 'Submit';
        this.isSubmitting = false;
        return;
      }

      this.deviceService.create(formData).subscribe({
        next: () => {
          this.toastrService.success(
            'Added Successfully !!',
            'Device! ' + element.serialNumber,
          );

          const index = deviceArray.indexOf(element);
          deviceArray.splice(index, 1);

          if (deviceArray.length === 0) {
            if (this.user.role === OrganizationType.Admin) {
              this.router.navigate(['/admin/All_devices']);
            } else if (this.user.role === OrganizationType.ApiUser) {
              this.router.navigate(['/apiuser/All_devices']);
            } else {
              this.router.navigate(['/device/AllList']);
            }
          }
        },
        error: (err) => {
          console.error('error caught in component', err.error.message);
          if (err.error.statusCode === 403) {
            this.toastrService.error(
              "You don't have the permissions to add a device.",
              'Access Denied',
            );
          } else {
            this.submitButtonText = 'Submit';
            this.isSubmitting = false;
            this.toastrService.error(
              err.error?.message ||
                err.message ||
                'Failed to register device ' + element.serialNumber,
              'Please try again. ',
            );
          }
        },
      });
    });
  }

  shortenFileName(fileName: string, maxLength: number = 20): string {
    return shortenFileName(fileName, maxLength);
  }

  openPopupDialog() {
    this.dialogRef = this.dialog.open(this.popupDialog, {
      width: '700px',
    });
    this.dialogRef.afterClosed().subscribe((result: boolean) => {
      if (result) {
        this.submitForm();
      } else {
        this.isSubmitting = false;
      }
    });
  }

  onAgreeClick() {
    this.submitButtonText = 'Submitting...';
    this.dialogRef.close(true);
  }

  updateMapMarkers(latitude: any, longitude: any) {
    if (this.mapComponent && latitude && longitude) {
      const markers = [
        {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
      ];

      this.mapComponent.markers = [...markers];

      if (this.mapComponent.isMapInitialized) {
        this.mapComponent.update();
      }
    }
  }
}
