import {
  Component,
  TemplateRef,
  ViewChild,
  EventEmitter,
  Output,
  OnDestroy,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
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
import { Observable, Subscription, Subject } from 'rxjs';
import { startWith, map, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
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
  OperatingConfiguration,
  SourceAccessMode,
  RegistrationType,
  VolumeEvidenceType,
  PublicFundingType,
  LABELLING_SCHEMES,
} from '../../../utils/drec.enum';
import { MapComponent } from '../../map/map.component';
import {
  getEvidenceRequirements,
  getHint,
  EvidenceRequirements,
  RequirementLevel,
} from '../../../utils/evidence-requirements';
import {
  validateAndAppendFiles,
  shortenFileName,
} from '../../../utils/file-upload.helper';
import { DOCUMENTS_EXTENSIONS } from '../../../constants/documents-extensions';
import { environment } from '../../../../environments/environment';

export type DeviceFiles = {
  [DocumentType.FORM_SF_02]: File[];
  [DocumentType.SF_02C]: File[];
  [DocumentType.SF_02C_OWNERS_DECLARATION]: File[];
  [DocumentType.METERING_EVIDENCE]: File[];
  [DocumentType.SINGLE_LINE_DIAGRAM]: File[];
  [DocumentType.PROJECT_PHOTOS]: File[];
  [DocumentType.COD_PROOF]: File[];
  [DocumentType.OTHER_DOCUMENTS]: File[];
};
type FileType = keyof DeviceFiles;

@Component({
  standalone: false,
  selector: 'app-add-devices',
  templateUrl: './add-devices.component.html',
  styleUrls: ['./add-devices.component.scss'],
})
export class AddDevicesComponent implements OnDestroy {
  @ViewChild('popupDialog') popupDialog = {} as TemplateRef<any>;
  @ViewChild('previewDialog') previewDialogTemplate = {} as TemplateRef<any>;
  @ViewChild('errorDialog') errorDialogTemplate = {} as TemplateRef<any>;
  @ViewChild('renameDialog') renameDialogTemplate = {} as TemplateRef<any>;
  @ViewChild('imageFullView') imageFullViewTemplate = {} as TemplateRef<any>;
  imageFullViewUrl: any = null;
  imageFullViewName: string = '';
  imageFullViewRef: any = null;
  previewDialogRef: any;
  previewData: { url: any; type: string; name: string } | null = null;
  currentPreviewFile: File | null = null;
  DataSourceTypes = DataSourceTypes;
  DocumentType = DocumentType;
  operatingConfigurations = Object.values(OperatingConfiguration);
  sourceAccessModes = Object.values(SourceAccessMode);
  labellingSchemes = LABELLING_SCHEMES;
  registrationTypes = Object.values(RegistrationType);
  volumeEvidenceTypes = Object.values(VolumeEvidenceType);
  publicFundingTypes = Object.values(PublicFundingType);
  evidenceReqs: EvidenceRequirements = getEvidenceRequirements(null);

  /** Called when operating configuration changes. Updates evidence requirements. */
  onOperatingConfigChange(config: string | null, formIndex: number): void {
    this.evidenceReqs = getEvidenceRequirements(config);
  }

  getDocRequirement(docType: string): RequirementLevel {
    return (this.evidenceReqs as any)[docType] ?? 'optional';
  }

  getDocHint(docType: string): string | null {
    const devices = this.myform.get('devices') as FormArray;
    if (!devices || devices.length === 0) return null;
    const config = devices.at(0)?.get('operatingConfiguration')?.value;
    return getHint(config, docType);
  }
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
  siteNameExists: boolean[] = [];
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
  serialNumberRegex: RegExp = /^[a-zA-Z0-9_;-]+$/;
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
  // Per-file labels staged locally. Keyed by device index → file type → position in files array.
  fileLabels: {
    [index: number]: { [fileType: string]: string[] };
  } = {};
  // Per-device list of serial/meter IDs, joined with ';' into the serialNumber form control on change.
  serialNumberLists: { [index: number]: string[] } = {};
  // Object URLs created for staged previews in the rename dialog — revoked on dialog close.
  renameObjectUrls: string[] = [];
  renameDialogDeviceIndex: number = 0;
  renameDialogType: string = '';
  renameDialogRef: any = null;
  filePreviews: {
    [index: number]: {
      [key: string]: {
        url: SafeResourceUrl;
        type: 'image' | 'pdf' | 'excel' | 'other';
        name: string;
      };
    };
  } = {};
  allDocumentsUploaded: boolean = false;
  formValid: boolean = false;
  isSubmitting: boolean = false;
  submitButtonText: string = 'Submit';
  requiredFileTypes: FileType[] = [
    DocumentType.FORM_SF_02,
    DocumentType.SF_02C,
    DocumentType.SF_02C_OWNERS_DECLARATION,
    DocumentType.METERING_EVIDENCE,
    DocumentType.SINGLE_LINE_DIAGRAM,
    DocumentType.PROJECT_PHOTOS,
    DocumentType.COD_PROOF,
  ];
  @ViewChild('streetMap') mapComponent: MapComponent;
  @ViewChild('satelliteMap') satelliteMapComponent: MapComponent;
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
    private sanitizer: DomSanitizer,
    private http: HttpClient,
  ) {
    this.user = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {
    this.loadData();
    this.initializeForm();
    this.addmoredetals[0] = false;
    this.showaddmore[0] = true;
    this.showerror[0] = false;
    this.siteNameExists[0] = false;
    this.shownomore[0] = false;

    this.deviceForms.controls.forEach((group, i) => {
      this.setupdataSourceBrandWatcher(group as FormGroup);
      this.setupDataSourceWatcher(group as FormGroup);
      this.setupSiteNameWatcher(group as FormGroup, i);
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    // Revoke object URLs to prevent memory leaks
    for (const deviceIndex of Object.keys(this.filePreviews)) {
      for (const fileType of Object.keys(this.filePreviews[+deviceIndex])) {
        const preview = this.filePreviews[+deviceIndex][fileType];
        if (preview?.url) {
          URL.revokeObjectURL(preview.url as unknown as string);
        }
      }
    }
  }

  private fetchOrganizationList() {
    this.orgService.getOrganizationInformation().subscribe((data) => {
      this.currentOrganization = data;
      if (
        ![OrganizationType.Registrant, OrganizationType.Admin].includes(
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
    } else if (this.user.role === OrganizationType.Registrant) {
      this.orgService.GetRegistrantAllOrganization().subscribe((data) => {
        this.organizationList = data.organizations.filter(
          (org: OrganizationInformation) =>
            org.organizationType === 'Registrant',
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
      siteName: [null],
      dataSource: [null],
      serialNumber: [null, Validators.pattern(this.serialNumberRegex)],
      otherDataSource: [''],
      address: [null],
      dataSourceBrand: [''],
      latitude: [null, Validators.pattern(this.numberregex)],
      longitude: [null, Validators.pattern(this.numberregex)],
      countryCodename: [null],
      fuelCode: ['ES100'],
      deviceTypeCode: [null],
      capacity: [null],
      commissioningDate: [new Date()],
      gridInterconnection: [null],
      operatingConfiguration: [null],
      sourceAccessMode: [null],
      offTaker: [null],
      impactStory: [null],
      data: [null],
      images: [null],
      deviceDescription: [null],
      stateProvince: [null],
      SDGBenefits: [[]],
      version: ['1.0'],
      postcode: [null, [postcodeValidator()]],
      defaultAccountCode: [null],
      requestedEffectiveRegDate: [null],
      signatoryName: [null],
      gridExportType: [null],
      hasNetworkMeter: [null],
      meterReadsShareable: [null],
      hasCaptiveConsumer: [null],
      hasAuxiliaryEnergySources: [null],
      auxiliaryEnergySourceDetails: [null],
      nonMeterImportDetails: [null],
      otherEacSchemeRegistration: [null],
      additionalInfo: [null],
      generatingUnitCount: [null],
      networkOwner: [null],
      interconnectionVoltage: [null],
      pvSystemOwner: [null],
      offTakerName: [null],
      offTakerSameCompanyAsOwner: [null],
      hasSubsidy: [null],
      subsidyTypes: [[]],
      subsidyOtherDetails: [null],
      subsidyClaimsEacs: [null],
      hasPublicFunding: [null],
      publicFundingEndDate: [null],
      registrationType: [null],
      volumeEvidenceType: [null],
      publicFundingType: [null],
      labellingSchemeAccreditation: [['The D-REC Label']],
      verificationAgentName: [null],
      offGridCircumstances: [null],
      FORM_SF_02: [null],
      SF_02C: [null],
      SF_02C_OWNERS_DECLARATION: [null],
      METERING_EVIDENCE: [null],
      SINGLE_LINE_DIAGRAM: [null],
      PROJECT_PHOTOS: [null],
      COD_PROOF: [null],
      OTHER_DOCUMENTS: [null],
      sf02EvidenceMode: ['self'],
    });

    device.get('latitude')?.valueChanges.subscribe((v: any) => {
      const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
      if (stripped !== v) device.get('latitude')?.setValue(stripped, { emitEvent: false });
      const longitude = device.get('longitude')?.value;
      this.updateMapMarkers(stripped, longitude);
    });
    device.get('longitude')?.valueChanges.subscribe((v: any) => {
      const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
      if (stripped !== v) device.get('longitude')?.setValue(stripped, { emitEvent: false });
      const latitude = device.get('latitude')?.value;
      this.updateMapMarkers(latitude, stripped);
    });

    this.deviceForms.push(device);
    this.serialNumberLists[this.deviceForms.length - 1] = [''];
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
      this.setupCountryAutocomplete(0);
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
      dataSource: [null],
      dataSourceBrand: [''],
      serialNumber: [null, Validators.pattern(this.serialNumberRegex)],
      otherDataSource: [''],
      siteName: [null],
      address: [null],
      latitude: [null, Validators.pattern(this.numberregex)],
      longitude: [null, Validators.pattern(this.numberregex)],
      countryCodename: [null],
      fuelCode: ['ES100'],
      deviceTypeCode: [null],
      capacity: [null],
      commissioningDate: [new Date()],
      gridInterconnection: [null],
      operatingConfiguration: [null],
      sourceAccessMode: [null],
      offTaker: [null],
      impactStory: [null],
      images: [null],
      deviceDescription: [null],
      stateOrProvince: [null],
      SDGBenefits: [[]],
      version: ['1.0'],
      postcode: [null, [postcodeValidator()]],
      defaultAccountCode: [null],
      requestedEffectiveRegDate: [null],
      signatoryName: [null],
      gridExportType: [null],
      hasNetworkMeter: [null],
      meterReadsShareable: [null],
      hasCaptiveConsumer: [null],
      hasAuxiliaryEnergySources: [null],
      auxiliaryEnergySourceDetails: [null],
      nonMeterImportDetails: [null],
      otherEacSchemeRegistration: [null],
      additionalInfo: [null],
      generatingUnitCount: [null],
      networkOwner: [null],
      interconnectionVoltage: [null],
      pvSystemOwner: [null],
      offTakerName: [null],
      offTakerSameCompanyAsOwner: [null],
      hasSubsidy: [null],
      subsidyTypes: [[]],
      subsidyOtherDetails: [null],
      subsidyClaimsEacs: [null],
      hasPublicFunding: [null],
      publicFundingEndDate: [null],
      registrationType: [null],
      volumeEvidenceType: [null],
      publicFundingType: [null],
      labellingSchemeAccreditation: [['The D-REC Label']],
      verificationAgentName: [null],
      offGridCircumstances: [null],
      FORM_SF_02: [null],
      SF_02C: [null],
      SF_02C_OWNERS_DECLARATION: [null],
      METERING_EVIDENCE: [null],
      SINGLE_LINE_DIAGRAM: [null],
      PROJECT_PHOTOS: [null],
      COD_PROOF: [null],
      OTHER_DOCUMENTS: [null],
      sf02EvidenceMode: ['self'],
    });

    this.deviceForms.push(device);
    this.showaddmore[this.deviceForms.length - 1] = true;
    this.serialNumberLists[this.deviceForms.length - 1] = [''];

    const index = this.deviceForms.length - 1;
    this.filteredCountryList[index] = this.getCountryCodeControl(
      index,
    ).valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '', index)),
    );

    this.setupDataSourceWatcher(device);
    this.siteNameExists[index] = false;
    this.setupSiteNameWatcher(device, index);
  }

  private setupSiteNameWatcher(deviceGroup: FormGroup, index: number) {
    deviceGroup.get('siteName')?.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((name: string) => {
        if (!name || name.trim().length < 2) {
          this.siteNameExists[index] = false;
          return [];
        }
        return this.deviceService.checkSiteName(name.trim());
      }),
    ).subscribe((res) => {
      this.siteNameExists[index] = res?.exists ?? false;
    });
  }

  private setupDataSourceWatcher(deviceGroup: FormGroup) {
    const dataSource = deviceGroup.get('dataSource');
    const serialNumber = deviceGroup.get('serialNumber');
    const otherDataSource = deviceGroup.get('otherDataSource');

    dataSource?.valueChanges.subscribe((value) => {
      if (value === DataSourceTypes.Other) {
        otherDataSource?.setValidators([Validators.required]);
      } else {
        otherDataSource?.clearValidators();
        otherDataSource?.reset();
      }
      otherDataSource?.updateValueAndValidity();
    });
  }

  getSerialNumberLabel(_index: number): string {
    // Checklist col F exact language (OC#14). Data source context is carried by
    // the separate dataSource dropdown and the per-row sub-labels ("smart meter",
    // "inverter 1", etc.) in the mini-table — no need to fold it into the OC label.
    return '(14) Meter or Measurement ID(s)';
  }
  private setupdataSourceBrandWatcher(deviceGroup: FormGroup) {
    const dataSource = deviceGroup.get('dataSource');
    const dataSourceBrand = deviceGroup.get('dataSourceBrand');

    dataSource?.valueChanges.subscribe(() => {
      dataSourceBrand?.updateValueAndValidity();
    });
  }

  dataSourceBrandLabel(index: number): string {
    const dataSource = this.deviceForms.at(index).get('dataSource')?.value;
    switch (dataSource) {
      case DataSourceTypes.Inverter:
        return 'Inverter Brand Name ⁽²⁷⁾';
      case DataSourceTypes.DataLogger:
        return 'Data Logger Brand Name ⁽²⁷⁾';
      case DataSourceTypes.Other:
        return 'Data source Brand Name ⁽²⁷⁾';
      default:
        return 'Data Source Brand Name ⁽²⁷⁾';
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

  deleteDevice(i: number) {
    this.deviceForms.removeAt(i);
    // Shift serialNumberLists indices down so they stay aligned with the FormArray.
    const shifted: { [index: number]: string[] } = {};
    const entries = Object.entries(this.serialNumberLists);
    for (const [k, v] of entries) {
      const n = Number(k);
      if (n === i) continue;
      shifted[n > i ? n - 1 : n] = v;
    }
    this.serialNumberLists = shifted;
  }

  getSerialNumbers(deviceIndex: number): string[] {
    if (!this.serialNumberLists[deviceIndex]) {
      this.serialNumberLists[deviceIndex] = [''];
    }
    return this.serialNumberLists[deviceIndex];
  }

  private syncSerialNumberControl(deviceIndex: number): void {
    const joined = (this.serialNumberLists[deviceIndex] || [])
      .map((v) => (v || '').trim())
      .filter((v) => v !== '')
      .join(';');
    const ctrl = this.deviceForms.at(deviceIndex).get('serialNumber');
    if (!ctrl) return;
    ctrl.setValue(joined === '' ? null : joined);
    ctrl.markAsDirty();
  }

  setSerialNumber(deviceIndex: number, rowIndex: number, value: string): void {
    const list = this.getSerialNumbers(deviceIndex);
    list[rowIndex] = value;
    this.syncSerialNumberControl(deviceIndex);
  }

  addSerialNumber(deviceIndex: number): void {
    this.getSerialNumbers(deviceIndex).push('');
  }

  removeSerialNumber(deviceIndex: number, rowIndex: number): void {
    const list = this.getSerialNumbers(deviceIndex);
    if (list.length <= 1) {
      list[0] = '';
    } else {
      list.splice(rowIndex, 1);
    }
    this.syncSerialNumberControl(deviceIndex);
  }

  trackByIndex(i: number) {
    return i;
  }

  getCountryCodeControl(index: number): FormControl {
    return this.deviceForms.at(index).get('countryCodename') as FormControl;
  }

  checkDocumentsUploaded() {
    const noFiles = Object.keys(this.files).length === 0;
    const allDocsUploaded = !noFiles && this.deviceForms.controls.every(
      (group, deviceIndex) => {
        if (!this.files[deviceIndex]) return false;
        return this.requiredFileTypes.every((fileType) => {
          // SF-02 not required when self-declaration mode is selected (platform generates it)
          if (
            fileType === DocumentType.FORM_SF_02 &&
            group.get('sf02EvidenceMode')?.value === 'self'
          ) {
            return true;
          }
          return this.files[deviceIndex][fileType]?.length > 0;
        });
      },
    );

    this.allDocumentsUploaded = allDocsUploaded;
    // Partial submit allowed: docs just influence the warning banner, not formValid
    this.formValid = this.myform.valid;
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

    const multiTypes: string[] = ['PROJECT_PHOTOS', 'METERING_EVIDENCE', 'OTHER_DOCUMENTS'];
    const prevLen = (this.files[deviceIndex][fileType] || []).length;
    if (multiTypes.includes(fileType)) {
      this.files[deviceIndex][fileType] = [
        ...(this.files[deviceIndex][fileType] || []),
        ...Array.from(files),
      ];
    } else {
      this.files[deviceIndex][fileType] = Array.from(files);
    }
    // Keep fileLabels aligned with files[] length per type.
    if (!this.fileLabels[deviceIndex]) this.fileLabels[deviceIndex] = {};
    const newLen = this.files[deviceIndex][fileType].length;
    if (multiTypes.includes(fileType)) {
      const existing = this.fileLabels[deviceIndex][fileType] || [];
      const appended = Array(newLen - prevLen).fill('');
      this.fileLabels[deviceIndex][fileType] = [...existing, ...appended];
    } else {
      this.fileLabels[deviceIndex][fileType] = Array(newLen).fill('');
    }

    const fileControl = this.deviceForms.at(deviceIndex).get(fileType);
    if (fileControl) {
      fileControl.setValue(this.files[deviceIndex][fileType][0] ?? input.files[0]);
      fileControl.markAsDirty();
    }

    // Generate preview
    const file = input.files[0];
    if (!this.filePreviews[deviceIndex]) {
      this.filePreviews[deviceIndex] = {};
    }
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const objectUrl = URL.createObjectURL(file);
    this.filePreviews[deviceIndex][fileType] = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
      type: isImage ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : 'other',
      name: file.name,
    };

    this.checkDocumentsUploaded();
  }

  openPreview(deviceIndex: number, fileType: string) {
    const preview = this.filePreviews[deviceIndex]?.[fileType];
    if (!preview) return;
    this.previewData = preview;
    this.currentPreviewFile =
      this.files[deviceIndex]?.[fileType as keyof DeviceFiles]?.[0] ?? null;
    this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'file-preview-dialog',
    });
  }

  renameableTypes: string[] = ['PROJECT_PHOTOS', 'METERING_EVIDENCE'];

  renameDialogFiles: { file: File; url: string; name: string; type: 'image' | 'pdf' | 'excel' | 'other'; label: string }[] = [];

  openRenameDialog(deviceIndex: number, fileType: string): void {
    const files = this.files[deviceIndex]?.[fileType as keyof DeviceFiles] || [];
    if (!files.length) return;
    // Revoke any URLs from a prior opening before creating new ones.
    for (const u of this.renameObjectUrls) URL.revokeObjectURL(u);
    this.renameObjectUrls = [];
    if (!this.fileLabels[deviceIndex]) this.fileLabels[deviceIndex] = {};
    if (!this.fileLabels[deviceIndex][fileType]) {
      this.fileLabels[deviceIndex][fileType] = Array(files.length).fill('');
    }
    this.renameDialogDeviceIndex = deviceIndex;
    this.renameDialogType = fileType;
    this.renameDialogFiles = files.map((f, i) => {
      const url = URL.createObjectURL(f);
      this.renameObjectUrls.push(url);
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const type: 'image' | 'pdf' | 'excel' | 'other' =
        ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext) ? 'image'
        : ext === 'pdf' ? 'pdf'
        : ext === 'xlsx' || ext === 'xls' ? 'excel'
        : 'other';
      return {
        file: f,
        url,
        name: f.name,
        type,
        label: this.fileLabels[deviceIndex][fileType][i] ?? '',
      };
    });
    this.renameDialogRef = this.dialog.open(this.renameDialogTemplate, {
      width: '1200px',
      maxWidth: '95vw',
      maxHeight: '92vh',
      disableClose: true,
    });
    this.renameDialogRef.afterClosed().subscribe(() => {
      // Release object URLs and clear dialog-local state. Label commit happens in saveRenameDialog().
      for (const u of this.renameObjectUrls) URL.revokeObjectURL(u);
      this.renameObjectUrls = [];
      this.renameDialogFiles = [];
    });
  }

  saveRenameDialog(): void {
    const labels = this.renameDialogFiles.map((r) => r.label || '');
    this.fileLabels[this.renameDialogDeviceIndex][this.renameDialogType] = labels;
    this.renameDialogRef?.close();
  }

  cancelRenameDialog(): void {
    this.renameDialogRef?.close();
  }

  fileExtension(name: string): string {
    return (name.split('.').pop() || '').toUpperCase();
  }

  openRenamePreview(r: { url: string; name: string; type: 'image' | 'pdf' | 'excel' | 'other'; file: File }): void {
    if (r.type === 'image') {
      this.imageFullViewUrl = r.url;
      this.imageFullViewName = r.name;
      this.imageFullViewRef = this.dialog.open(this.imageFullViewTemplate, {
        width: '100vw',
        maxWidth: '100vw',
        height: '100vh',
        panelClass: 'image-full-view-dialog',
      });
      return;
    }
    this.previewData = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(r.url),
      type: r.type,
      name: r.name,
    };
    this.currentPreviewFile = r.file;
    this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'file-preview-dialog',
    });
  }

  /** Fetch documents for the freshly-created device and PATCH labels for any we staged. */
  private persistStagedLabels(deviceId: number, deviceIndex: number): void {
    const labelsByType = this.fileLabels[deviceIndex];
    if (!labelsByType) return;
    // Only the three user-facing categories support rename. Skip the call if nothing is set.
    const hasAny = this.renameableTypes.some((t) =>
      (labelsByType[t] || []).some((l) => l && l.trim() !== ''),
    );
    if (!hasAny) return;
    this.deviceService.getDocuments(deviceId).subscribe({
      next: (docs) => {
        for (const type of this.renameableTypes) {
          const files = this.files[deviceIndex]?.[type as keyof DeviceFiles] || [];
          const labels = labelsByType[type] || [];
          for (let i = 0; i < files.length; i++) {
            const label = (labels[i] || '').trim();
            if (!label) continue;
            const match = docs.find(
              (d) => d.type === type && d.originalFilename === files[i].name && !d.label,
            );
            if (!match) continue;
            this.deviceService.updateDocumentLabel(match.id, label).subscribe({
              error: (err) =>
                console.warn(`Failed to save label for ${files[i].name}`, err?.message),
            });
          }
        }
      },
      error: (err) => console.warn('Failed to fetch documents for labeling', err?.message),
    });
  }

  onSubmit() {
    this.myform.markAllAsTouched();
    this.checkDocumentsUploaded();
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

      // Truncate lat/long to 9 decimal places (backend regex limit)
      if (element.latitude) {
        const [intLat, decLat] = String(element.latitude).split('.');
        element.latitude = decLat ? `${intLat}.${decLat.slice(0, 20)}` : intLat;
      }
      if (element.longitude) {
        const [intLng, decLng] = String(element.longitude).split('.');
        element.longitude = decLng ? `${intLng}.${decLng.slice(0, 20)}` : intLng;
      }

      // OC#37 is a multi-select in the UI but stored as a '; '-joined string
      if (Array.isArray(element.labellingSchemeAccreditation)) {
        element.labellingSchemeAccreditation =
          element.labellingSchemeAccreditation.join('; ') || null;
      }

      formData.append('deviceToRegister', JSON.stringify(element));

      // E-signature evidence
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('fingerprint', 2, 2);
      }
      const canvasHash = canvas.toDataURL();

      formData.append(
        'eSignature',
        JSON.stringify({
          browserFingerprint: canvasHash
            ? btoa(canvasHash).substring(0, 64)
            : null,
          screenResolution: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          signedAt: new Date().toISOString(),
          metadata: {
            colorDepth: screen.colorDepth,
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency,
            touchSupport: navigator.maxTouchPoints > 0,
          },
        }),
      );
      if (element.countryCode) {
        formData.append('countryCode', element.countryCode);
      } else {
        console.error('Country code is missing for device:', element);
      }

      const fileFields: FileType[] = [
        DocumentType.FORM_SF_02,
        DocumentType.SF_02C,
        DocumentType.SF_02C_OWNERS_DECLARATION,
        DocumentType.METERING_EVIDENCE,
        DocumentType.SINGLE_LINE_DIAGRAM,
        DocumentType.PROJECT_PHOTOS,
        DocumentType.COD_PROOF,
        DocumentType.OTHER_DOCUMENTS,
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

      const sf02Mode = this.deviceForms.at(index)?.get('sf02EvidenceMode')?.value;

      this.deviceService.create(formData).subscribe({
        next: (result: any) => {
          this.toastrService.success(
            'Added Successfully !!',
            'Device! ' + element.serialNumber,
          );

          // Persist any per-file labels the registrant set in the rename dialog.
          if (result?.id) {
            this.persistStagedLabels(result.id, index);
          }

          // Auto-generate SF-02 registration form when self-declaration mode is selected
          if (sf02Mode === 'self' && result?.id) {
            this.http.post(
              `${environment.API_URL}device-reviews/${result.id}/generate-sf02`,
              {},
            ).subscribe({
              next: () => this.toastrService.info('SF-02 registration form generated', 'SF-02'),
              error: (err) => console.warn('SF-02 generation failed:', err?.message),
            });
          }

          const idx = deviceArray.indexOf(element);
          deviceArray.splice(idx, 1);

          if (deviceArray.length === 0) {
            if (this.user.role === OrganizationType.Admin) {
              this.router.navigate(['/admin/All_devices']);
            } else if (this.user.role === OrganizationType.Registrant) {
              this.router.navigate(['/registrant/All_devices']);
            } else {
              this.router.navigate(['/device/AllList']);
            }
          }
        },
        error: (err) => {
          console.error('error caught in component', err.error.message);
          this.submitButtonText = 'Submit';
          this.isSubmitting = false;
          const message =
            err.error?.message || err.message || 'Failed to register device';
          if (err.status === 409 || err.error?.statusCode === 409) {
            this.dialog.open(this.errorDialogTemplate, {
              width: '450px',
              data: { title: 'Duplicate Entry', message },
            });
          } else if (err.error?.statusCode === 403) {
            this.toastrService.error(
              "You don't have the permissions to add a device.",
              'Access Denied',
            );
          } else {
            this.toastrService.error(message, 'Please try again.');
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

  mapAdjusting = false;
  coordsDirty = false;
  private mapCenterUpdating = false;
  private savedCoords: { lat: string; lng: string } | null = null;
  private coordDeviceIndex = 0;

  onMapCenterChanged(center: { lat: number; lng: number }, deviceIndex: number): void {
    if (this.mapCenterUpdating) return;
    this.mapCenterUpdating = true;
    const group = this.deviceForms.at(deviceIndex);
    if (group) {
      if (!this.savedCoords) {
        this.savedCoords = {
          lat: group.get('latitude')?.value || '',
          lng: group.get('longitude')?.value || '',
        };
        this.coordDeviceIndex = deviceIndex;
      }
      group.get('latitude')?.setValue(center.lat, { emitEvent: false });
      group.get('longitude')?.setValue(center.lng, { emitEvent: false });
      // Only mark dirty if coords actually changed from the original
      const origLat = parseFloat(this.savedCoords.lat);
      const origLng = parseFloat(this.savedCoords.lng);
      this.coordsDirty = center.lat !== origLat || center.lng !== origLng;
    }
    this.mapCenterUpdating = false;
  }

  onCoordPaste(event: ClipboardEvent, deviceIndex: number): void {
    const text = event.clipboardData?.getData('text') ?? '';
    const parts = text.split(/\t+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length !== 2) return;
    if (isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) return;
    event.preventDefault();
    const group = this.deviceForms.at(deviceIndex);
    group.get('latitude')?.setValue(parts[0]);
    group.get('longitude')?.setValue(parts[1]);
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    this.mapComponent?.recenter(lat, lng);
    this.satelliteMapComponent?.recenter(lat, lng);
  }

  cancelCoordChange(): void {
    if (!this.savedCoords) return;
    const group = this.deviceForms.at(this.coordDeviceIndex);
    if (group) {
      group.get('latitude')?.setValue(this.savedCoords.lat, { emitEvent: false });
      group.get('longitude')?.setValue(this.savedCoords.lng, { emitEvent: false });
      const lat = parseFloat(this.savedCoords.lat);
      const lng = parseFloat(this.savedCoords.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        this.mapComponent?.recenter(lat, lng);
        this.satelliteMapComponent?.recenter(lat, lng);
      }
    }
    this.savedCoords = null;
    this.coordsDirty = false;
  }

  confirmCoordChange(): void {
    this.savedCoords = null;
    this.coordsDirty = false;
  }

  onScreenshotFromMap(file: File, deviceIndex: number): void {
    if (!this.files[deviceIndex]) {
      this.files[deviceIndex] = this.requiredFileTypes.reduce(
        (acc, docType) => {
          acc[docType] = [];
          return acc;
        },
        {} as DeviceFiles,
      );
    }
    // Phase 1c: map captures are saved as METERING_EVIDENCE (SCREENSHOTS merged in)
    if (!this.files[deviceIndex][DocumentType.METERING_EVIDENCE]) {
      this.files[deviceIndex][DocumentType.METERING_EVIDENCE] = [];
    }
    this.files[deviceIndex][DocumentType.METERING_EVIDENCE].push(file);

    const fileControl = this.deviceForms.at(deviceIndex).get('METERING_EVIDENCE');
    if (fileControl) {
      fileControl.setValue(file);
      fileControl.markAsDirty();
    }

    // Generate preview so the file is viewable
    if (!this.filePreviews[deviceIndex]) {
      this.filePreviews[deviceIndex] = {};
    }
    const objectUrl = URL.createObjectURL(file);
    this.filePreviews[deviceIndex][DocumentType.METERING_EVIDENCE] = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
      type: 'image',
      name: file.name,
    };

    this.toastrService.success(`Map capture "${file.name}" added as metering evidence`, 'Captured');
  }

  updateMapMarkers(latitude: any, longitude: any) {
    if (latitude && longitude) {
      const markers = [
        {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
      ];

      if (this.mapComponent) {
        this.mapComponent.markers = [...markers];
        if (this.mapComponent.isMapInitialized) {
          this.mapComponent.update();
        }
      }

      if (this.satelliteMapComponent) {
        this.satelliteMapComponent.markers = [...markers];
        if (this.satelliteMapComponent.isMapInitialized) {
          this.satelliteMapComponent.update();
        }
      }
    }
  }

}
