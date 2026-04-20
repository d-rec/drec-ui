import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import {
  FormGroup,
  FormBuilder,
  Validators,
  FormControl,
} from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import { DeviceService } from '../../../auth/services/device.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { CountryInfo, fulecodeType, devicecodeType } from '../../../models';
import { postcodeValidator } from '../../../utils/validate-postcode';
import { MapComponent } from '../../map/map.component';
import { DocumentType, OperatingConfiguration, PublicFundingType, RegistrationType, SourceAccessMode, VolumeEvidenceType } from '../../../utils/drec.enum';
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

type FileType =
  | DocumentType.FORM_SF_02
  | DocumentType.SF_02C
  | DocumentType.SF_02C_OWNERS_DECLARATION
  | DocumentType.METERING_EVIDENCE
  | DocumentType.SINGLE_LINE_DIAGRAM
  | DocumentType.PROJECT_PHOTOS
  | DocumentType.SCREENSHOTS
  | DocumentType.COD_PROOF
  | DocumentType.OTHER_DOCUMENTS;

@Component({
  standalone: false,
  selector: 'app-edit-device',
  templateUrl: './edit-device.component.html',
  styleUrls: ['./edit-device.component.scss'],
})
export class EditDeviceComponent implements OnInit, OnDestroy {
  @ViewChild('errorDialog') errorDialogTemplate = {} as TemplateRef<any>;
  @ViewChild('previewDialog') previewDialogTemplate = {} as TemplateRef<any>;
  @ViewChild('renameDialog') renameDialogTemplate = {} as TemplateRef<any>;
  @ViewChild('imageFullView') imageFullViewTemplate = {} as TemplateRef<any>;
  renameDialogType: string = '';
  renameDialogRef: any = null;
  imageFullViewUrl: any = null;
  imageFullViewName: string = '';
  imageFullViewRef: any = null;
  previewDialogRef: any;
  previewData: { url: any; type: string; name: string } | null = null;
  currentPreviewFile: File | null = null;
  loginuser: any;
  updateDeviceForm: FormGroup;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  devicetypelist: devicecodeType[] = [];
  numberregex: RegExp = /[0-9]+(\.[0-9]*){0,1}/;
  maxDate = new Date();
  public date: any;
  addmoredetals: any;
  shownomore: any;
  showaddmore: any;
  public sdgblist: any;
  id: number;
  externalid: any;
  serialNumber: any;
  status: any;
  siteName: any;
  address: any;
  latitude: any;
  longitude: any;
  countryCode: any;
  fuelCode: any;
  deviceTypeCode: any;
  capacity: any;
  SDGBenefits: any = [];
  commissioningDate: any;
  offTaker: any;
  gridInterconnection: any;
  operatingConfiguration: any;
  operatingConfigurations = Object.values(OperatingConfiguration);
  sourceAccessMode: any;
  sourceAccessModes = Object.values(SourceAccessMode);
  registrationTypes = Object.values(RegistrationType);
  volumeEvidenceTypes = Object.values(VolumeEvidenceType);
  publicFundingTypes = Object.values(PublicFundingType);
  evidenceReqs: EvidenceRequirements = getEvidenceRequirements(null);
  impactStory: any;
  showerror: boolean = false;
  deviceDescription: any;
  stateProvince: any;
  postcode: any;
  frommydevice: boolean = false;
  frombulk: boolean = false;
  filteredCountryList: Observable<any[]>;
  organizationId: any;

  // Document upload support
  DocumentType = DocumentType;
  files: { [key: string]: File[] } = {};
  filePreviews: { [key: string]: { url: SafeResourceUrl; type: 'image' | 'pdf' | 'excel' | 'other'; name: string } } = {};
  existingDocs: {
    [type: string]: {
      url: string;
      name: string;
      id: number;
      label: string | null;
    }[];
  } = {};
  // Which doc categories support per-file rename (registrant-facing).
  renameableDocTypes: string[] = [
    DocumentType.PROJECT_PHOTOS,
    DocumentType.SCREENSHOTS,
    DocumentType.METERING_EVIDENCE,
  ];
  brokenDocs: { [type: string]: boolean } = {};

  // Evident-compliant upload checklists — upload is gated until all items are ticked
  static readonly DOC_CHECKLISTS: Record<string, string[]> = {
    FORM_SF_02: [
      'The SF-02 has been fully completed, signed, and dated.',
      'The official name of the facility matches the name provided on the Registry and other supporting documents.',
      'The capacity (in MW) matches the installed Alternating Current (AC) capacity shown on the Single Line Diagram (SLD) and supporting documents.',
      'The effective date of registration matches the date inputted on the Registry. It must not be before the effective date of registration set out by the Residual Mix Deadline.',
      'The number of generating units (generators) is provided and matches the amount in the supporting SLD.',
      'The serial numbers of the facility\'s meters are provided.',
    ],
    SF_02C: [], // radio selection handled separately
    METERING_EVIDENCE: [
      'The facility name and/or meter serial number(s) are highlighted and match the details provided in the form SF-02.',
      'The units of measurement (kWh/MWh) are highlighted.',
      'The production period dates are highlighted.',
      'The eligible production figure is highlighted.',
      'Proof that the data has been verified by an independent third-party has been provided.',
    ],
    SINGLE_LINE_DIAGRAM: [
      'The facility name is visible.',
      'The generating units (generators) are highlighted.',
      'The capacity is annotated on each generator in MW/kW.',
      'The metering point(s) are highlighted.',
      'The document has been signed or stamped by the facility owner or engineer.',
    ],
    PROJECT_PHOTOS: [
      'The external photos show the facility and surrounding geography.',
    ],
  };
  docChecklists = EditDeviceComponent.DOC_CHECKLISTS;
  checklistState: { [docType: string]: boolean[] } = {};
  sf02cType: 'declaration' | 'ownership' | null = null;

  initChecklists(): void {
    for (const [docType, items] of Object.entries(EditDeviceComponent.DOC_CHECKLISTS)) {
      this.checklistState[docType] = new Array(items.length).fill(false);
    }
  }

  allChecked(docType: string): boolean {
    const items = EditDeviceComponent.DOC_CHECKLISTS[docType];
    if (!items?.length) return true;
    return this.checklistState[docType]?.every(Boolean) ?? false;
  }

  sf02cReady(): boolean {
    return this.sf02cType !== null;
  }

  existingDocLabel(type: string): string {
    const docs = this.existingDocs[type];
    if (!docs?.length) return '';
    if (docs.length === 1) return docs[0].label || docs[0].name;
    return docs.length + ' files uploaded';
  }

  saveDocumentLabel(
    type: string,
    index: number,
    nextLabel: string,
  ): void {
    const docs = this.existingDocs[type];
    const entry = docs?.[index];
    if (!entry) return;
    const trimmed = nextLabel.trim();
    const normalized = trimmed === '' ? null : trimmed;
    if (normalized === entry.label) return;
    this.deviceService.updateDocumentLabel(entry.id, normalized).subscribe({
      next: () => {
        entry.label = normalized;
        this.toastrService.success('Label saved');
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Failed to save label';
        this.toastrService.error(msg);
      },
    });
  }
  fileTypes: FileType[] = [
    DocumentType.FORM_SF_02,
    DocumentType.SF_02C,
    DocumentType.SF_02C_OWNERS_DECLARATION,
    DocumentType.METERING_EVIDENCE,
    DocumentType.SINGLE_LINE_DIAGRAM,
    DocumentType.PROJECT_PHOTOS,
    DocumentType.SCREENSHOTS,
    DocumentType.COD_PROOF,
    DocumentType.OTHER_DOCUMENTS,
  ];

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
  devicediscription = [
    'Solar Lantern',
    'Solar Home System',
    'Mini Grid',
    'Rooftop Solar',
    'Ground Mount Solar',
  ];
  @ViewChild('streetMap') mapComponent: MapComponent;
  @ViewChild('satelliteMap') satelliteMapComponent: MapComponent;

  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
  ) {
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params['fromdevices'] != undefined) {
        this.frommydevice = params['fromdevices'];
      }
      if (params['frombulk'] != undefined) {
        this.frombulk = params['frombulk'];
      }
    });
    this.externalid = this.activatedRoute.snapshot.params['id'];
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {
    this.date = new Date();
    this.initChecklists();
    this.updateDeviceForm = this.fb.group({
      serialNumber: [null, [Validators.pattern(/^[a-zA-Z0-9_;-]+$/)]],
      siteName: [null],
      address: [null, [Validators.required]],
      latitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      longitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      countryCode: [null, Validators.required],
      fuelCode: ['ES100', [Validators.required]],
      deviceTypeCode: [null, [Validators.required]],
      capacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: [true],
      operatingConfiguration: [null],
      sourceAccessMode: [null],
      offTaker: [null],
      impactStory: [null],
      images: [null],
      deviceDescription: [null],
      stateProvince: [null],
      SDGBenefits: [new FormControl([])],
      version: ['1.0'],
      organizationId: [null],
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
      labellingSchemeAccreditation: [null],
      verificationAgentName: [null],
      offGridCircumstances: [null],
      sf02EvidenceMode: ['self'],
    });
    this.addmoredetals = false;
    this.showaddmore = true;
    this.shownomore = false;
    this.updateDeviceForm.valueChanges.subscribe();
    this.updateDeviceForm
      .get('latitude')
      ?.valueChanges.subscribe((v) => {
        const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
        if (stripped !== v) this.updateDeviceForm.get('latitude')?.setValue(stripped, { emitEvent: false });
        const longitude = this.updateDeviceForm.get('longitude')?.value;
        this.updateMapMarkers(stripped, longitude);
      });
    this.updateDeviceForm
      .get('longitude')
      ?.valueChanges.subscribe((v) => {
        const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
        if (stripped !== v) this.updateDeviceForm.get('longitude')?.setValue(stripped, { emitEvent: false });
        const latitude = this.updateDeviceForm.get('latitude')?.value;
        this.updateMapMarkers(latitude, stripped);
      });
    forkJoin({
      countrylist: this.authService.GetMethod('countrycode/list'),
      sdgblist: this.authService.GetMethod('sdgbenefit/code'),
      fuellist: this.authService.GetMethod('device/fuel-type'),
      devicetypelist: this.authService.GetMethod('device/device-type'),
    }).subscribe(({ countrylist, sdgblist, fuellist, devicetypelist }: any) => {
      this.countrylist = countrylist;
      this.sdgblist = sdgblist;
      this.fuellist = fuellist;
      this.devicetypelist = devicetypelist;
      this.filteredCountryList = this.updateDeviceForm.controls[
        'countryCode'
      ].valueChanges.pipe(
        startWith(''),
        map((value) => this._filter(value || '')),
      );
      this.getDeviceinfo();
    });
  }
  private _filter(value: string): CountryInfo[] {
    const filterValue = value.toLowerCase();

    if (
      !(
        this.countrylist.filter((option: any) =>
          option.country.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      this.showerror = true;
    } else {
      this.showerror = false;
    }
    return this.countrylist.filter((code) =>
      code.country.toLowerCase().includes(filterValue),
    );
  }
  getCountryCodeControl(): FormControl {
    return this.updateDeviceForm.get('countryCode') as FormControl;
  }
  checkValidation(input: string) {
    const validation =
      this.updateDeviceForm.get(input)?.invalid &&
      (this.updateDeviceForm.get(input)?.dirty ||
        this.updateDeviceForm.get(input)?.touched);
    return validation;
  }
  serialNumberErrors() {
    return this.updateDeviceForm.get('serialNumber')?.hasError('required')
      ? 'This field is required'
      : this.updateDeviceForm.get('serialNumber')?.hasError('pattern')
        ? 'Serial number(s) must contain only letters, numbers, underscores, hyphens, or semicolons'
        : '';
  }
  DisplayList() {
    this.authService.GetMethod('countrycode/list').subscribe((data1: any) => {
      this.countrylist = data1;
    });
  }
  DisplaySDGBList() {
    this.authService.GetMethod('sdgbenefit/code').subscribe((data2) => {
      this.sdgblist = data2;
    });
  }
  DisplayfuelList() {
    this.authService.GetMethod('device/fuel-type').subscribe((data3: any) => {
      this.fuellist = data3;
    });
  }
  DisplaytypeList() {
    this.authService.GetMethod('device/device-type').subscribe((data4: any) => {
      this.devicetypelist = data4;
    });
  }
  private initSerialNumber: string | null = null;
  addmore() {
    this.addmoredetals = true;
    this.shownomore = true;
    this.showaddmore = false;
  }
  nomore() {
    this.addmoredetals = false;
    this.showaddmore = true;
    this.shownomore = false;
  }
  getDeviceinfo() {
    this.deviceService
      .getDeviceInfoBYexternalId(this.externalid)
      .subscribe((data) => {
        this.id = data.id;
        this.serialNumber = data.serialNumber;
        this.status = data.status;
        this.siteName = data.siteName;
        this.address = data.address;
        this.latitude = data.latitude;
        this.longitude = data.longitude;
        this.countryCode = this.countrylist.find(
          (countrycode) => countrycode.alpha3 == data.countryCode,
        )?.country;
        this.fuelCode = data.fuelCode;
        this.deviceTypeCode = data.deviceTypeCode;
        this.capacity = data.capacity;
        this.postcode = data.postcode;
        data.SDGBenefits.forEach((sdgbname: string, index: number) => {
          const foundEle = this.sdgblist.find(
            (ele: any) =>
              ele.value.toLowerCase() === sdgbname.toString().toLowerCase(),
          );
          data.SDGBenefits[index] = foundEle.name;
        });
        this.SDGBenefits = data.SDGBenefits;
        this.commissioningDate = data.commissioningDate;
        this.offTaker = data.offTaker;
        this.impactStory = data.impactStory;
        this.gridInterconnection = data.gridInterconnection;
        this.operatingConfiguration = data.operatingConfiguration || null;
        this.sourceAccessMode = data.sourceAccessMode || null;
        this.evidenceReqs = getEvidenceRequirements(this.operatingConfiguration);
        this.deviceDescription = data.deviceDescription;
        this.stateProvince = data.stateProvince;
        this.organizationId = data.organizationId;
        this.updateDeviceForm.patchValue({
          serialNumber: data.serialNumber,
        });
        this.initSerialNumber = data.serialNumber;

        // Load existing documents
        this.deviceService.getDocuments(data.id).subscribe((docs) => {
          this.existingDocs = {};
          for (const doc of docs) {
            if (!this.existingDocs[doc.type]) this.existingDocs[doc.type] = [];
            let name = doc.url.split('/').pop()?.split('?')[0] || doc.type;
            // Decode + as space, then repeatedly decodeURIComponent for double-encoded keys
            name = name.replace(/\+/g, ' ');
            let prev = '';
            while (name !== prev) {
              prev = name;
              try { name = decodeURIComponent(name); } catch { break; }
            }
            // Strip embedded UUIDs
            name = name.replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
            // Strip upload timestamp+index suffix (e.g. _1752226304295_1.pdf → .pdf)
            name = name.replace(/_\d{10,}_\d+\./, '.');
            this.existingDocs[doc.type].push({
              url: doc.url,
              name: doc.originalFilename || name,
              id: doc.id,
              label: doc.label,
            });
          }
          // Check each document URL for 404s (GET + abort, since HEAD may be blocked by CORS)
          this.brokenDocs = {};
          for (const type of Object.keys(this.existingDocs)) {
            for (const doc of this.existingDocs[type]) {
              if (!doc.url) { this.brokenDocs[type] = true; continue; }
              const ctrl = new AbortController();
              fetch(doc.url, { method: 'GET', mode: 'cors', signal: ctrl.signal }).then(
                (res) => { ctrl.abort(); if (!res.ok) this.brokenDocs[type] = true; },
                (err) => { if (err?.name !== 'AbortError') this.brokenDocs[type] = true; },
              );
            }
            // Pre-populate filePreviews for existing docs so View button shows
            if (!this.filePreviews[type] && this.existingDocs[type]?.length) {
              const doc = this.existingDocs[type][0];
              const ext = doc.name.split('.').pop()?.toLowerCase() || '';
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
              const isPdf = ext === 'pdf';
              const isExcel = ext === 'xlsx' || ext === 'xls';
              this.filePreviews[type] = {
                url: this.sanitizer.bypassSecurityTrustResourceUrl(doc.url),
                type: isImage ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : 'other',
                name: doc.name,
              };
            }
          }
        });
      });
  }
  ngOnDestroy() {
    for (const key of Object.keys(this.filePreviews)) {
      const preview = this.filePreviews[key];
      if (preview?.url) {
        URL.revokeObjectURL(preview.url as unknown as string);
      }
    }
  }

  onFileChange(event: Event, fileType: FileType) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.files[fileType] = Array.from(input.files);

    const file = input.files[0];
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const objectUrl = URL.createObjectURL(file);
    this.filePreviews[fileType] = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
      type: isImage ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : 'other',
      name: file.name,
    };
  }

  openPreview(fileType: string) {
    const preview = this.filePreviews[fileType];
    if (!preview) return;
    this.previewData = preview;
    this.currentPreviewFile = this.files[fileType]?.[0] ?? null;
    this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'file-preview-dialog',
    });
  }

  openRenameDialog(docType: string): void {
    if (!this.existingDocs[docType]?.length) return;
    this.renameDialogType = docType;
    this.renameDialogRef = this.dialog.open(this.renameDialogTemplate, {
      width: '1200px',
      maxWidth: '95vw',
      maxHeight: '92vh',
    });
  }

  isImageFile(name: string): boolean {
    const ext = (name.split('.').pop() || '').toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  }

  isPdfFile(name: string): boolean {
    return (name.split('.').pop() || '').toLowerCase() === 'pdf';
  }

  fileExtension(name: string): string {
    return (name.split('.').pop() || '').toUpperCase();
  }

  openRenamePreview(d: { url: string; name: string }): void {
    if (this.isImageFile(d.name)) {
      this.imageFullViewUrl = d.url;
      this.imageFullViewName = d.name;
      this.imageFullViewRef = this.dialog.open(this.imageFullViewTemplate, {
        width: '100vw',
        maxWidth: '100vw',
        height: '100vh',
        panelClass: 'image-full-view-dialog',
      });
      return;
    }
    const ext = (d.name.split('.').pop() || '').toLowerCase();
    const type: 'image' | 'pdf' | 'excel' | 'other' =
      this.isPdfFile(d.name) ? 'pdf'
      : ext === 'xlsx' || ext === 'xls' ? 'excel'
      : 'other';
    this.previewData = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(d.url),
      type,
      name: d.name,
    };
    this.currentPreviewFile = null;
    this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'file-preview-dialog',
    });
  }

  shortenFileName(fileName: string, maxLength: number = 20): string {
    return shortenFileName(fileName, maxLength);
  }

  onSubmit() {
    const selectedCountry: CountryInfo | undefined = this.countrylist.find(
      (option) => option.country === this.updateDeviceForm.value.countryCode,
    );
    this.updateDeviceForm.controls['organizationId'].setValue(
      this.organizationId ?? this.loginuser?.organizationId,
    );
    if (this.updateDeviceForm.controls['serialNumber'].value == null) {
      this.updateDeviceForm.controls['serialNumber'].setValue(this.serialNumber);
    }
    this.updateDeviceForm.controls['countryCode'].setValue(selectedCountry?.alpha3);

    // Capture the form value once — .value returns a new snapshot each call
    const formValue = this.updateDeviceForm.value;

    // Truncate lat/long to 9 decimal places (backend regex limit)
    if (formValue.latitude) {
      const [intLat, decLat] = String(formValue.latitude).split('.');
      formValue.latitude = decLat ? `${intLat}.${decLat.slice(0, 20)}` : intLat;
    }
    if (formValue.longitude) {
      const [intLng, decLng] = String(formValue.longitude).split('.');
      formValue.longitude = decLng ? `${intLng}.${decLng.slice(0, 20)}` : intLng;
    }

    // Check if any files were selected
    const hasFiles = this.fileTypes.some(
      (ft) => this.files[ft]?.length > 0,
    );

    let payload: FormData | Record<string, any>;

    if (hasFiles) {
      // Send as multipart FormData (requires updated backend with FileFieldsInterceptor)
      const formData = new FormData();
      formData.append('deviceToUpdate', JSON.stringify(formValue));

      const allowedExtensions = [...DOCUMENTS_EXTENSIONS];
      const maxSizeInMB = 20;
      let allErrors: Record<string, string[]> = {};

      this.fileTypes.forEach((fileType: FileType) => {
        const files = this.files[fileType];
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
        console.error('One or more files are invalid.', allErrors);
        return;
      }
      payload = formData;
    } else {
      // No files — send as plain JSON (compatible with current backend)
      payload = formValue;
    }

    this.deviceService
      .update(
        this.externalid,
        payload,
        this.updateDeviceForm.controls['serialNumber'].value !== this.initSerialNumber,
      )
      .subscribe({
        next: (data: any) => {
          this.toastrService.success(
            'Updated Successfully !!',
            'Device! ' + data.serialNumber,
          );
          if (this.loginuser.role === 'Admin') {
            this.router.navigate(['/admin/All_devices']);
          } else if (this.loginuser.role === 'Registrant') {
            this.router.navigate(['/registrant/All_devices']);
          } else {
            this.router.navigate(['/device/AllList']);
          }
        },
        error: (err: any): void => {
          console.error('error caught in component', err.error.message);
          const message =
            err.error?.message || err.message || 'Failed to update device';
          if (err.status === 409 || err.error?.statusCode === 409) {
            this.dialog.open(this.errorDialogTemplate, {
              width: '450px',
              data: { title: 'Duplicate Entry', message },
            });
          } else {
            this.toastrService.error(message, 'Device ' + this.externalid);
          }
        },
      });
  }
  reset() {
    if (this.frombulk) {
      this.router.navigate(['/device/bulk_upload']);
    } else {
      this.router.navigate(['/device/AllList']);
    }
  }

  mapAdjusting = false;
  private mapCenterUpdating = false;
  private savedCoords: { lat: string; lng: string } | null = null;

  coordsDirty = false;

  onMapCenterChanged(center: { lat: number; lng: number }): void {
    if (this.mapCenterUpdating) return;
    this.mapCenterUpdating = true;
    if (!this.savedCoords) {
      this.savedCoords = {
        lat: this.latitude,
        lng: this.longitude,
      };
    }
    this.updateDeviceForm.get('latitude')?.setValue(center.lat, { emitEvent: false });
    this.updateDeviceForm.get('longitude')?.setValue(center.lng, { emitEvent: false });
    this.latitude = String(center.lat);
    this.longitude = String(center.lng);
    // Only mark dirty if coords actually changed from the original
    const origLat = parseFloat(this.savedCoords.lat);
    const origLng = parseFloat(this.savedCoords.lng);
    this.coordsDirty = center.lat !== origLat || center.lng !== origLng;
    this.mapCenterUpdating = false;
  }

  cancelCoordChange(): void {
    if (!this.savedCoords) return;
    this.latitude = this.savedCoords.lat;
    this.longitude = this.savedCoords.lng;
    this.updateDeviceForm.get('latitude')?.setValue(this.savedCoords.lat, { emitEvent: false });
    this.updateDeviceForm.get('longitude')?.setValue(this.savedCoords.lng, { emitEvent: false });
    const lat = parseFloat(this.savedCoords.lat);
    const lng = parseFloat(this.savedCoords.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      this.mapComponent?.recenter(lat, lng);
      this.satelliteMapComponent?.recenter(lat, lng);
    }
    this.savedCoords = null;
    this.coordsDirty = false;
  }

  confirmCoordChange(): void {
    // Build the same payload onSubmit would, but without files or navigation
    const selectedCountry: CountryInfo | undefined = this.countrylist.find(
      (option) => option.country === this.updateDeviceForm.value.countryCode,
    );
    this.updateDeviceForm.controls['organizationId'].setValue(
      this.organizationId ?? this.loginuser?.organizationId,
    );
    if (this.updateDeviceForm.controls['serialNumber'].value == null) {
      this.updateDeviceForm.controls['serialNumber'].setValue(this.serialNumber);
    }
    this.updateDeviceForm.controls['countryCode'].setValue(selectedCountry?.alpha3);

    const formValue = { ...this.updateDeviceForm.value };
    if (formValue.latitude) {
      const [intLat, decLat] = String(formValue.latitude).split('.');
      formValue.latitude = decLat ? `${intLat}.${decLat.slice(0, 20)}` : intLat;
    }
    if (formValue.longitude) {
      const [intLng, decLng] = String(formValue.longitude).split('.');
      formValue.longitude = decLng ? `${intLng}.${decLng.slice(0, 20)}` : intLng;
    }

    this.deviceService
      .update(this.externalid, formValue, false)
      .subscribe({
        next: () => {
          this.toastrService.success('Coordinates saved');
          this.savedCoords = null;
          this.coordsDirty = false;
          // Restore country display name so form still shows it correctly
          if (selectedCountry) {
            this.updateDeviceForm.controls['countryCode'].setValue(selectedCountry.country);
          }
        },
        error: (err: any) => {
          this.toastrService.error(err.error?.message || 'Failed to save coordinates');
          // Restore country display name on error too
          if (selectedCountry) {
            this.updateDeviceForm.controls['countryCode'].setValue(selectedCountry.country);
          }
        },
      });
  }

  onScreenshotFromMap(file: File): void {
    if (!this.files[DocumentType.SCREENSHOTS]) {
      this.files[DocumentType.SCREENSHOTS] = [];
    }
    this.files[DocumentType.SCREENSHOTS].push(file);

    // Generate preview so the file is viewable
    const objectUrl = URL.createObjectURL(file);
    this.filePreviews[DocumentType.SCREENSHOTS] = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
      type: 'image',
      name: file.name,
    };

    this.toastrService.success(`Screenshot "${file.name}" added`, 'Screenshot');
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

  onOperatingConfigChange(config: string | null): void {
    this.evidenceReqs = getEvidenceRequirements(config);
  }

  getDocRequirement(docType: string): RequirementLevel {
    return (this.evidenceReqs as any)[docType] ?? 'optional';
  }

  getDocHint(docType: string): string | null {
    return getHint(this.operatingConfiguration, docType);
  }
}
