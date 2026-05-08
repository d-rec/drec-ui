import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  TemplateRef,
  NgZone,
} from '@angular/core';
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
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { CountryInfo, fulecodeType, devicecodeType } from '../../../models';
import { postcodeValidator } from '../../../utils/validate-postcode';
import { environment } from '../../../../environments/environment';
import { MapComponent } from '../../map/map.component';
import {
  DocumentType,
  LABELLING_SCHEMES,
  OperatingConfiguration,
  RegistrationType,
  SourceAccessMode,
  VolumeEvidenceType,
} from '../../../utils/drec.enum';
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
import {
  CodExtractedFields,
  DocumentClassifierService,
  MeterIdsExtractedFields,
  Sf02ExtractedFields,
  Sf02cExtractedFields,
  SldExtractedFields,
} from '../../../utils/document-classifier.service';
import {
  ClassificationResult,
  DOCUMENT_TYPE_LABELS,
} from '../../../utils/document-keywords';

type FileType =
  | DocumentType.FORM_SF_02
  | DocumentType.SF_02C
  | DocumentType.PROOF_OF_OWNERSHIP
  | DocumentType.METERING_EVIDENCE
  | DocumentType.SINGLE_LINE_DIAGRAM
  | DocumentType.PROJECT_PHOTOS
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
  renameDialogDraft: string[] = [];
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
  labellingSchemes = LABELLING_SCHEMES;
  registrationTypes = Object.values(RegistrationType);
  volumeEvidenceTypes = Object.values(VolumeEvidenceType);
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
  filePreviews: {
    [key: string]: {
      url: SafeResourceUrl;
      type: 'image' | 'pdf' | 'excel' | 'other';
      name: string;
    };
  } = {};
  existingDocs: {
    [type: string]: {
      url: string;
      name: string;
      id: number;
      label: string | null;
      createdAt?: string;
    }[];
  } = {};
  // Which doc categories support per-file rename (registrant-facing).
  renameableDocTypes: string[] = [
    DocumentType.PROJECT_PHOTOS,
    DocumentType.METERING_EVIDENCE,
  ];
  brokenDocs: { [type: string]: boolean } = {};

  /** AI document classification suggestions per fileType. */
  classificationSuggestions: { [fileType: string]: ClassificationResult | null } = {};
  classifying: { [fileType: string]: boolean } = {};

  /** SLD vision extraction state. */
  sldExtraction: SldExtractedFields | null = null;
  sldExtracting = false;

  /** SF-02c text/vision extraction state. */
  sf02cExtraction: Sf02cExtractedFields | null = null;
  sf02cExtracting = false;

  codExtraction: CodExtractedFields | null = null;
  codExtracting = false;

  sf02Extraction: Sf02ExtractedFields | null = null;
  sf02Extracting = false;

  meterIdsExtraction: string[] = [];
  meterIdsBrand = '';
  meterIdsExtracting = false;

  /** Auto-classifier extraction phase. When true, the magic-overlay
   *  shows the consolidated extraction view instead of the
   *  classification table. */
  magicExtractMode = false;
  conflictPicks: { [field: string]: string } = {};

  magicCurrentFile: string | null = null;
  magicCurrentStep: string | null = null;
  DOCUMENT_TYPE_LABELS = DOCUMENT_TYPE_LABELS;

  /** Magic auto-sort state. */
  magicRunning = false;
  magicDone = 0;
  magicTotal = 0;
  magicLog: Array<{
    filename: string;
    target: string;
    confidence: number | null;
    type: 'hit' | 'miss';
    file?: File;
    docType?: string;
  }> = [];
  private magicBackupFiles: { [key: string]: File[] } = {};
  private magicBackupPreviews: typeof this.filePreviews = {};

  // Evident-compliant upload checklists — upload is gated until all items are ticked
  static readonly DOC_CHECKLISTS: Record<string, string[]> = {
    FORM_SF_02: [
      'The SF-02 has been fully completed, signed, and dated.',
      'The official name of the facility matches the name provided on the Registry and other supporting documents.',
      'The capacity (in MW) matches the installed Alternating Current (AC) capacity shown on the Single Line Diagram (SLD) and supporting documents.',
      'The effective date of registration matches the date inputted on the Registry. It must not be before the effective date of registration set out by the Residual Mix Deadline.',
      'The number of generating units (generators) is provided and matches the amount in the supporting SLD.',
      "The serial numbers of the facility's meters are provided.",
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
    for (const [docType, items] of Object.entries(
      EditDeviceComponent.DOC_CHECKLISTS,
    )) {
      this.checklistState[docType] = new Array(items.length).fill(false);
    }
  }

  allChecked(docType: string): boolean {
    const items = EditDeviceComponent.DOC_CHECKLISTS[docType];
    if (!items?.length) return true;
    return this.checklistState[docType]?.every(Boolean) ?? false;
  }

  // OC#14 serial-list helpers. serialNumber is stored as a '; '-joined string;
  // UI renders it as an editable mini-table and joins on change.
  trackByIndex = (i: number) => i;

  getSerialNumbers(): string[] {
    const raw = this.updateDeviceForm?.get('serialNumber')?.value;
    if (raw == null || raw === '') return [''];
    const arr = String(raw).split(/\s*;\s*/);
    return arr.length ? arr : [''];
  }

  setSerialNumber(index: number, value: string): void {
    const arr = this.getSerialNumbers();
    arr[index] = value;
    const joined = arr.filter((s) => s !== '').join(';');
    this.updateDeviceForm
      .get('serialNumber')
      ?.setValue(joined || null, { emitEvent: false });
    this.updateDeviceForm.get('serialNumber')?.markAsDirty();
  }

  addSerialNumber(): void {
    const arr = this.getSerialNumbers();
    arr.push('');
    const joined = arr.filter((s) => s !== '').join(';');
    this.updateDeviceForm
      .get('serialNumber')
      ?.setValue(joined || null, { emitEvent: false });
    // Force the *ngFor to see the new empty slot by re-reading through the
    // form control value — since we don't push '', we need a sentinel:
    // push a trailing ';' so split yields an extra empty entry.
    const cur = this.updateDeviceForm.get('serialNumber')?.value ?? '';
    this.updateDeviceForm
      .get('serialNumber')
      ?.setValue(cur + (cur ? ';' : ''), { emitEvent: false });
    // Move focus to the newly-added input after Angular renders it
    setTimeout(() => {
      const list = document.querySelector('.serial-list');
      const inputs = list?.querySelectorAll<HTMLInputElement>('input');
      if (inputs && inputs.length) inputs[inputs.length - 1].focus();
    }, 0);
  }

  removeSerialNumber(index: number): void {
    const arr = this.getSerialNumbers();
    if (arr.length <= 1) return;
    arr.splice(index, 1);
    const joined = arr.filter((s) => s !== '').join(';');
    this.updateDeviceForm
      .get('serialNumber')
      ?.setValue(joined || null, { emitEvent: false });
    this.updateDeviceForm.get('serialNumber')?.markAsDirty();
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

  deleteExistingDoc(type: string, docIndex: number): void {
    const doc = this.existingDocs[type]?.[docIndex];
    if (!doc) return;
    if (!confirm(`Delete "${doc.label || doc.name}"?`)) return;
    this.deviceService.deleteDocument(this.id, doc.id).subscribe({
      next: () => {
        this.existingDocs[type].splice(docIndex, 1);
        if (!this.existingDocs[type].length) {
          delete this.existingDocs[type];
          delete this.filePreviews[type];
        }
        this.toastrService.success('Document deleted');
      },
      error: (err) => {
        this.toastrService.error(
          err?.error?.message || 'Failed to delete document',
        );
      },
    });
  }

  viewExistingDoc(doc: { url: string; name: string; id: number }): void {
    const ext = doc.name.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    const isPdf = ext === 'pdf';
    const isExcel = ext === 'xlsx' || ext === 'xls';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', gif: 'image/gif', webp: 'image/webp',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
    };
    this.deviceService.getDocumentBlob(doc.id).subscribe({
      next: (blob: Blob) => {
        const typed = new Blob([blob], { type: mimeMap[ext] || blob.type });
        const objUrl = URL.createObjectURL(typed);
        this.previewData = {
          url: this.sanitizer.bypassSecurityTrustResourceUrl(objUrl),
          type: isImage ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : 'other',
          name: doc.name,
        };
        this.currentPreviewFile = new File([typed], doc.name, { type: typed.type });
        this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
          width: '95vw',
          maxWidth: '1400px',
          height: '90vh',
          panelClass: 'file-preview-dialog',
        });
      },
      error: () => this.toastrService.error('Failed to load document'),
    });
  }

  saveRenameDialog(): void {
    const docs = this.existingDocs[this.renameDialogType] || [];
    const changed: {
      entry: (typeof docs)[number];
      normalized: string | null;
    }[] = [];
    for (let i = 0; i < docs.length; i++) {
      const trimmed = (this.renameDialogDraft[i] ?? '').trim();
      const normalized = trimmed === '' ? null : trimmed;
      if (normalized !== (docs[i].label ?? null)) {
        changed.push({ entry: docs[i], normalized });
      }
    }
    if (changed.length === 0) {
      this.renameDialogRef?.close();
      return;
    }
    let remaining = changed.length;
    let failed = 0;
    for (const { entry, normalized } of changed) {
      this.deviceService.updateDocumentLabel(entry.id, normalized).subscribe({
        next: () => {
          entry.label = normalized;
          remaining--;
          if (remaining === 0 && failed === 0) {
            this.toastrService.success(`Saved ${changed.length} label(s)`);
            this.renameDialogRef?.close();
          } else if (remaining === 0) {
            this.toastrService.warning(`Saved with ${failed} failure(s)`);
            this.renameDialogRef?.close();
          }
        },
        error: (err) => {
          failed++;
          remaining--;
          const msg = err?.error?.message || err?.message || 'Failed';
          this.toastrService.error(`${entry.name}: ${msg}`);
          if (remaining === 0) this.renameDialogRef?.close();
        },
      });
    }
  }

  cancelRenameDialog(): void {
    this.renameDialogRef?.close();
  }
  fileTypes: FileType[] = [
    DocumentType.FORM_SF_02,
    DocumentType.SF_02C,
    DocumentType.PROOF_OF_OWNERSHIP,
    DocumentType.METERING_EVIDENCE,
    DocumentType.SINGLE_LINE_DIAGRAM,
    DocumentType.PROJECT_PHOTOS,
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
    private documentClassifier: DocumentClassifierService,
    private ngZone: NgZone,
    private http: HttpClient,
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
      address: [null],
      latitude: [null, Validators.pattern(this.numberregex)],
      longitude: [null, Validators.pattern(this.numberregex)],
      countryCode: [null],
      fuelCode: ['ES100'],
      deviceTypeCode: [null],
      capacity: [null],
      commissioningDate: [new Date()],
      gridInterconnection: [true],
      operatingConfiguration: [null],
      sourceAccessMode: [null],
      offTaker: [null],
      impactStory: [null],
      images: [null],
      deviceDescription: [null],
      stateProvince: [null],
      SDGBenefits: [[]],
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
      labellingSchemeAccreditation: [[] as string[]],
      verificationAgentName: [null],
      offGridCircumstances: [null],
      sf02EvidenceMode: ['self'],
    });
    this.updateDeviceForm.valueChanges.subscribe();
    this.updateDeviceForm.get('latitude')?.valueChanges.subscribe((v) => {
      const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
      if (stripped !== v)
        this.updateDeviceForm
          .get('latitude')
          ?.setValue(stripped, { emitEvent: false });
      // Manual text edit — dismiss the "Location adjusted via map" bar
      if (!this.mapCenterUpdating) {
        this.savedCoords = null;
        this.coordsDirty = false;
      }
      const longitude = this.updateDeviceForm.get('longitude')?.value;
      this.updateMapMarkers(stripped, longitude);
    });
    this.updateDeviceForm.get('longitude')?.valueChanges.subscribe((v) => {
      const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
      if (stripped !== v)
        this.updateDeviceForm
          .get('longitude')
          ?.setValue(stripped, { emitEvent: false });
      // Manual text edit — dismiss the "Location adjusted via map" bar
      if (!this.mapCenterUpdating) {
        this.savedCoords = null;
        this.coordsDirty = false;
      }
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
        this.evidenceReqs = getEvidenceRequirements(
          this.operatingConfiguration,
        );
        this.deviceDescription = data.deviceDescription;
        this.stateProvince = data.stateProvince;
        this.organizationId = data.organizationId;
        // OC#37 storage is a '; '-joined string on the backend; the UI form uses an array
        const labellingSchemeArr: string[] = data.labellingSchemeAccreditation
          ? String(data.labellingSchemeAccreditation)
              .split(/\s*;\s*/)
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

        this.updateDeviceForm.patchValue({
          serialNumber: data.serialNumber,
          labellingSchemeAccreditation: labellingSchemeArr,
        });
        this.initSerialNumber = data.serialNumber;

        // Load existing documents
        this.deviceService.getDocuments(data.id).subscribe({
          error: () => {},
          next: (docs) => {
          this.existingDocs = {};
          for (const doc of docs) {
            if (!this.existingDocs[doc.type]) this.existingDocs[doc.type] = [];
            let name = doc.url.split('/').pop()?.split('?')[0] || doc.type;
            // Decode + as space, then repeatedly decodeURIComponent for double-encoded keys
            name = name.replace(/\+/g, ' ');
            let prev = '';
            while (name !== prev) {
              prev = name;
              try {
                name = decodeURIComponent(name);
              } catch {
                break;
              }
            }
            // Strip embedded UUIDs
            name = name.replace(
              /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
              '',
            );
            // Strip upload timestamp+index suffix (e.g. _1752226304295_1.pdf → .pdf)
            name = name.replace(/_\d{10,}_\d+\./, '.');
            this.existingDocs[doc.type].push({
              url: doc.url,
              name: doc.originalFilename || name,
              id: doc.id,
              label: doc.label,
              createdAt: doc.createdAt,
            });
          }
          // Check each document URL for 404s (GET + abort, since HEAD may be blocked by CORS)
          this.brokenDocs = {};
          for (const type of Object.keys(this.existingDocs)) {
            for (const doc of this.existingDocs[type]) {
              if (!doc.url) {
                this.brokenDocs[type] = true;
                continue;
              }
              const ctrl = new AbortController();
              fetch(doc.url, {
                method: 'GET',
                mode: 'cors',
                signal: ctrl.signal,
              }).then(
                (res) => {
                  ctrl.abort();
                  if (!res.ok) this.brokenDocs[type] = true;
                },
                (err) => {
                  if (err?.name !== 'AbortError') this.brokenDocs[type] = true;
                },
              );
            }
            // Pre-populate filePreviews for existing docs so View button shows
            if (!this.filePreviews[type] && this.existingDocs[type]?.length) {
              const doc = this.existingDocs[type][0];
              const ext = doc.name.split('.').pop()?.toLowerCase() || '';
              const isImage = [
                'jpg',
                'jpeg',
                'png',
                'gif',
                'webp',
                'bmp',
              ].includes(ext);
              const isPdf = ext === 'pdf';
              const isExcel = ext === 'xlsx' || ext === 'xls';
              this.filePreviews[type] = {
                url: this.sanitizer.bypassSecurityTrustResourceUrl(doc.url),
                type: isImage
                  ? 'image'
                  : isPdf
                    ? 'pdf'
                    : isExcel
                      ? 'excel'
                      : 'other',
                name: doc.name,
              };
            }
          }
        }});
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

  /** Check if a file with the same name already exists in any slot. */
  private isDuplicate(file: File): boolean {
    return this.duplicateMatch(file) !== null;
  }
  /** Returns the slot key where this file is already attached (staged
   *  in this session, OR already saved server-side from a previous edit),
   *  or null. We can't size-match server-saved docs (we only have the
   *  filename), so name alone is enough there. */
  private duplicateMatch(file: File): string | null {
    for (const [slot, list] of Object.entries(this.files)) {
      if (list?.some((f: File) => f.name === file.name && f.size === file.size)) {
        return slot;
      }
    }
    for (const [slot, docs] of Object.entries(this.existingDocs)) {
      if (docs?.some((d) => d.name === file.name)) {
        return slot;
      }
    }
    return null;
  }

  onFileChange(event: Event, fileType: FileType) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const skipped: string[] = [];
    const newFiles: File[] = [];
    for (const f of Array.from(input.files)) {
      const where = this.duplicateMatch(f);
      if (where) skipped.push(`${f.name} (already in ${where})`);
      else newFiles.push(f);
    }
    if (skipped.length) {
      this.toastrService.info(
        `Skipped: ${skipped.join('; ')}`,
        'Files can only live in one slot',
      );
    }
    if (newFiles.length === 0) {
      input.value = '';
      return;
    }

    this.files[fileType] = newFiles;

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

    // Trigger background AI classification
    this.classifyUploadedFile(file, fileType);

    // For SLDs, also trigger field extraction (vision via Haiku)
    if (fileType === DocumentType.SINGLE_LINE_DIAGRAM) {
      this.extractSldFieldsForDevice(file);
    }
    if (fileType === DocumentType.SF_02C) {
      this.extractSf02cFieldsForDevice(file);
    }
    if (fileType === DocumentType.COD_PROOF) {
      this.extractCodFieldsForDevice(file);
    }
    if (fileType === DocumentType.FORM_SF_02) {
      this.extractSf02FieldsForDevice(file);
    }
    if (fileType === DocumentType.METERING_EVIDENCE) {
      for (const f of newFiles) {
        this.extractMeterIdsForDevice(f);
      }
    }
  }

  /** Magic auto-sort: classify multiple files and dispatch them to slots. */
  onMagicUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const filesToProcess = Array.from(input.files);
    input.value = '';

    this.magicRunning = true;
    this.magicDone = 0;
    this.magicTotal = filesToProcess.length;
    this.magicLog = [];
    this.magicBackupFiles = {};
    for (const key of Object.keys(this.files)) {
      this.magicBackupFiles[key] = [...this.files[key]];
    }
    this.magicBackupPreviews = { ...this.filePreviews };

    const processNext = (idx: number) => {
      if (idx >= filesToProcess.length) {
        this.ngZone.run(() => {
          this.magicRunning = false;
          this.magicCurrentFile = null;
          this.magicCurrentStep = null;
        });
        return;
      }

      const file = filesToProcess[idx];
      this.ngZone.run(() => {
        this.magicCurrentFile = file.name;
        this.magicCurrentStep = null;
      });
      const dupSlot = this.duplicateMatch(file);
      if (dupSlot) {
        // Don't route the file (it's already on the server / staged),
        // but DO classify it so the OK + Extract path can run the
        // matching field extractor against the bytes the user just
        // dropped. Without this every re-upload would short-circuit
        // and the consolidated dialog would say "no fields could be
        // extracted from these documents."
        this.documentClassifier.classify(file, (step) =>
          this.ngZone.run(() => {
            this.magicCurrentStep = step;
          }),
        ).subscribe({
          next: (result) => {
            this.ngZone.run(() => {
              const rawType = result?.suggestedType ?? DocumentType.OTHER_DOCUMENTS;
              this.magicLog.push({
                filename: file.name.length > 40 ? file.name.substring(0, 37) + '...' : file.name,
                target: `Skipped (already in ${dupSlot})`,
                confidence: null,
                type: 'miss',
                file,
                docType: rawType,
              });
              this.magicDone = idx + 1;
            });
            setTimeout(() => processNext(idx + 1));
          },
          error: () => {
            this.ngZone.run(() => {
              this.magicLog.push({
                filename: file.name.length > 40 ? file.name.substring(0, 37) + '...' : file.name,
                target: `Skipped (already in ${dupSlot})`,
                confidence: null,
                type: 'miss',
                file,
              });
              this.magicDone = idx + 1;
            });
            setTimeout(() => processNext(idx + 1));
          },
        });
        return;
      }
      this.documentClassifier.classify(file, (step) =>
        this.ngZone.run(() => {
          this.magicCurrentStep = step;
        }),
      ).subscribe({
        next: (result) => {
          this.ngZone.run(() => {
            const rawType = result?.suggestedType ?? DocumentType.OTHER_DOCUMENTS;
            // FACILITY_BOUNDARY has no registrant-side upload slot today,
            // so drop the boundary jpg into PROJECT_PHOTOS where it can
            // still be reviewed. The magic-table label below still shows
            // "Facility Boundary" so the reviewer knows what it is.
            const targetType =
              rawType === DocumentType.FACILITY_BOUNDARY
                ? DocumentType.PROJECT_PHOTOS
                : rawType;
            const label =
              this.DOCUMENT_TYPE_LABELS[rawType] ?? 'Other Document';
            const confidence = result
              ? Math.round(result.confidence * 100)
              : null;

            const multiTypes = [
              'PROJECT_PHOTOS',
              'METERING_EVIDENCE',
              'OTHER_DOCUMENTS',
            ];
            if (multiTypes.includes(targetType)) {
              this.files[targetType] = [
                ...(this.files[targetType] || []),
                file,
              ];
            } else {
              this.files[targetType] = [file];
            }

            // Generate preview
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';
            const isExcel = /\.(xlsx|xls)$/i.test(file.name);
            const objectUrl = URL.createObjectURL(file);
            this.filePreviews[targetType] = {
              url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
              type: isImage
                ? 'image'
                : isPdf
                  ? 'pdf'
                  : isExcel
                    ? 'excel'
                    : 'other',
              name: file.name,
            };

            this.magicLog.push({
              filename: file.name.length > 40
                ? file.name.substring(0, 37) + '...'
                : file.name,
              target: label,
              confidence,
              type: result && result.suggestedType !== DocumentType.OTHER_DOCUMENTS
                ? 'hit'
                : 'miss',
              file,
              docType: rawType,
            });

            this.magicDone = idx + 1;
            processNext(idx + 1);
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.files[DocumentType.OTHER_DOCUMENTS] = [
              ...(this.files[DocumentType.OTHER_DOCUMENTS] || []),
              file,
            ];

            this.magicLog.push({
              filename: file.name.length > 40
                ? file.name.substring(0, 37) + '...'
                : file.name,
              target: 'Other Document',
              confidence: null,
              type: 'miss',
              file,
            });

            this.magicDone = idx + 1;
            processNext(idx + 1);
          });
        },
      });
    };

    processNext(0);
  }

  acceptMagic(): void {
    this.magicLog = [];
    this.magicBackupFiles = {};
    this.magicBackupPreviews = {};
  }

  /** Copy the auto-classify results as TSV (file, target, confidence) so the
   *  registrant can paste into a spreadsheet or share with support. */
  copyMagicLog(): void {
    const header = 'File\tClassified as\tConfidence';
    const rows = this.magicLog.map((e) =>
      [
        e.filename,
        e.target,
        e.confidence != null ? `${e.confidence}%` : '—',
      ].join('\t'),
    );
    const text = [header, ...rows].join('\n');
    const done = () =>
      this.toastrService.info(`Copied ${rows.length} row(s) to clipboard`);
    navigator.clipboard?.writeText(text).then(done, () => {
      // Fallback for non-secure contexts.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        done();
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  cancelMagic(): void {
    this.files = this.magicBackupFiles;
    this.filePreviews = this.magicBackupPreviews;
    this.magicLog = [];
    this.magicBackupFiles = {};
    this.magicBackupPreviews = {};
  }

  private extractSldFieldsForDevice(file: File): void {
    this.sldExtracting = true;
    this.sldExtraction = null;
    const deviceId = typeof this.id === 'number' ? this.id : undefined;
    this.documentClassifier
      .extractSldFields(file, deviceId)
      .then((res) =>
        this.ngZone.run(() => {
          this.sldExtracting = false;
          this.sldExtraction = res;
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.sldExtracting = false;
        }),
      );
  }

  applySldExtraction(): void {
    const fx = this.sldExtraction;
    if (!fx) return;
    const patchIfEmpty = (
      controlName: string,
      field: { value: any; confidence: number } | undefined,
      transform?: (v: any) => any,
    ) => {
      if (!field || field.confidence < 0.7) return;
      const ctl = this.updateDeviceForm.get(controlName);
      if (!ctl) return;
      const current = ctl.value;
      if (current !== null && current !== undefined && current !== '') return;
      const v = transform ? transform(field.value) : field.value;
      ctl.setValue(v);
      ctl.markAsDirty();
    };
    patchIfEmpty('capacity', fx.acCapacityKw);
    patchIfEmpty('generatingUnitCount', fx.inverterCount);
    patchIfEmpty('interconnectionVoltage', fx.gridVoltage);
    patchIfEmpty(
      'gridInterconnection',
      fx.gridTied,
      (v) => (v ? 'true' : 'false'),
    );
    patchIfEmpty('dataSourceBrand', fx.inverterMakeModel);
    if (fx.inverterMakeModel || fx.inverterCount) {
      this.setDataSourceIfEmpty('Inverter');
    }
    this.toastrService.success('SLD fields applied to the form');
  }

  private setDataSourceIfEmpty(value: string): void {
    const ctl = this.updateDeviceForm.get('dataSource');
    if (!ctl) return;
    if (ctl.value !== null && ctl.value !== undefined && ctl.value !== '') return;
    ctl.setValue(value);
    ctl.markAsDirty();
  }

  dismissSldExtraction(): void {
    this.sldExtraction = null;
  }

  private extractSf02cFieldsForDevice(file: File): void {
    this.sf02cExtracting = true;
    this.sf02cExtraction = null;
    const deviceId = typeof this.id === 'number' ? this.id : undefined;
    this.documentClassifier
      .extractSf02cFields(file, deviceId)
      .then((res) =>
        this.ngZone.run(() => {
          this.sf02cExtracting = false;
          this.sf02cExtraction = res;
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.sf02cExtracting = false;
        }),
      );
  }

  applySf02cExtraction(): void {
    const fx = this.sf02cExtraction;
    if (!fx) return;
    const patchIfEmpty = (
      controlName: string,
      field: { value: any; confidence: number } | undefined,
    ) => {
      if (!field || field.confidence < 0.7) return;
      const ctl = this.updateDeviceForm.get(controlName);
      if (!ctl) return;
      const current = ctl.value;
      if (current !== null && current !== undefined && current !== '') return;
      ctl.setValue(field.value);
      ctl.markAsDirty();
    };
    patchIfEmpty('siteName', fx.projectName);
    patchIfEmpty('pvSystemOwner', fx.ownerLegalName);
    patchIfEmpty('address', fx.ownerAddress);
    patchIfEmpty('countryCodename', fx.ownerCountry);
    this.toastrService.success('SF-02c fields applied to the form');
  }

  dismissSf02cExtraction(): void {
    this.sf02cExtraction = null;
  }

  private extractCodFieldsForDevice(file: File): void {
    this.codExtracting = true;
    this.codExtraction = null;
    const deviceId = typeof this.id === 'number' ? this.id : undefined;
    this.documentClassifier
      .extractCodFields(file, deviceId)
      .then((res) =>
        this.ngZone.run(() => {
          this.codExtracting = false;
          this.codExtraction = res;
          if (
            res?.measurementIds &&
            res.measurementIds.confidence >= 0.7 &&
            res.measurementIds.value.length
          ) {
            const set = new Set(this.meterIdsExtraction);
            for (const id of res.measurementIds.value) set.add(id);
            this.meterIdsExtraction = [...set];
          }
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.codExtracting = false;
        }),
      );
  }

  private extractMeterIdsForDevice(file: File): void {
    this.meterIdsExtracting = true;
    const deviceId = typeof this.id === 'number' ? this.id : undefined;
    this.documentClassifier
      .extractMeterIds(file, deviceId)
      .then((res) =>
        this.ngZone.run(() => {
          this.meterIdsExtracting = false;
          if (res?.measurementIds && res.measurementIds.confidence >= 0.7) {
            const set = new Set(this.meterIdsExtraction);
            for (const id of res.measurementIds.value) set.add(id);
            this.meterIdsExtraction = [...set];
          }
          if (res?.inverterMakeModel && res.inverterMakeModel.confidence >= 0.7) {
            this.meterIdsBrand = res.inverterMakeModel.value;
          }
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.meterIdsExtracting = false;
        }),
      );
  }

  applyMeterIdsExtraction(): void {
    if (!this.meterIdsExtraction.length) return;
    const ctl = this.updateDeviceForm.get('serialNumber');
    if (!ctl) {
      console.warn('[meter-ids] serialNumber control not found');
      return;
    }
    const current = String(ctl.value ?? '').trim();
    const existing = current ? current.split(/\s*;\s*/).filter(Boolean) : [];
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const id of [...existing, ...this.meterIdsExtraction]) {
      const k = id.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(id);
    }
    if (merged.length === existing.length) {
      this.toastrService.info('No new measurement IDs to add');
      return;
    }
    ctl.setValue(merged.join(';'));
    ctl.markAsDirty();
    this.setDataSourceIfEmpty('Inverter');
    if (this.meterIdsBrand) {
      const brandCtl = this.updateDeviceForm.get('dataSourceBrand');
      if (brandCtl) {
        const cur = String(brandCtl.value ?? '').trim();
        if (!cur) {
          brandCtl.setValue(this.meterIdsBrand);
          brandCtl.markAsDirty();
        }
      }
    }
    const added = merged.length - existing.length;
    this.toastrService.success(
      `${added} measurement ID${added === 1 ? '' : 's'} added`,
    );
  }

  dismissMeterIdsExtraction(): void {
    this.meterIdsExtraction = [];
  }

  applyCodExtraction(): void {
    const fx = this.codExtraction;
    if (!fx) return;
    const patchIfEmpty = (
      controlName: string,
      field: { value: any; confidence: number } | undefined,
    ) => {
      if (!field || field.confidence < 0.7) return;
      const ctl = this.updateDeviceForm.get(controlName);
      if (!ctl) return;
      const current = ctl.value;
      if (current !== null && current !== undefined && current !== '') return;
      ctl.setValue(field.value);
      ctl.markAsDirty();
    };
    patchIfEmpty('commissioningDate', fx.commissioningDate);
    patchIfEmpty('siteName', fx.facilityName);
    patchIfEmpty('capacity', fx.acCapacityKw);
    patchIfEmpty('pvSystemOwner', fx.ownerName);
    this.toastrService.success('COD proof fields applied to the form');
  }

  dismissCodExtraction(): void {
    this.codExtraction = null;
  }

  private extractSf02FieldsForDevice(file: File): void {
    this.sf02Extracting = true;
    this.sf02Extraction = null;
    const deviceId = typeof this.id === 'number' ? this.id : undefined;
    this.documentClassifier
      .extractSf02Fields(file, deviceId)
      .then((res) =>
        this.ngZone.run(() => {
          this.sf02Extracting = false;
          this.sf02Extraction = res;
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.sf02Extracting = false;
        }),
      );
  }

  applySf02Extraction(): void {
    const fx = this.sf02Extraction;
    if (!fx) return;
    const patchIfEmpty = (
      controlName: string,
      field: { value: any; confidence: number } | undefined,
    ) => {
      if (!field || field.confidence < 0.7) return;
      const ctl = this.updateDeviceForm.get(controlName);
      if (!ctl) return;
      const current = ctl.value;
      if (current !== null && current !== undefined && current !== '') return;
      ctl.setValue(field.value);
      ctl.markAsDirty();
    };
    patchIfEmpty('siteName', fx.facilityName);
    patchIfEmpty('capacity', fx.acCapacityKw);
    patchIfEmpty('commissioningDate', fx.commissioningDate);
    patchIfEmpty('deviceTypeCode', fx.deviceTypeCode);
    patchIfEmpty('pvSystemOwner', fx.ownerLegalName);
    patchIfEmpty('address', fx.ownerAddress);
    patchIfEmpty('countryCodename', fx.ownerCountry);
    patchIfEmpty('latitude', fx.latitude);
    patchIfEmpty('longitude', fx.longitude);
    patchIfEmpty('generatingUnitCount', fx.inverterCount);
    if (fx.inverterCount) {
      this.setDataSourceIfEmpty('Inverter');
    }
    this.toastrService.success('SF-02 fields applied to the form');
  }

  dismissSf02Extraction(): void {
    this.sf02Extraction = null;
  }

  extractAllFromMagic(): void {
    const log = [...this.magicLog];
    // Drop the cancel-rollback backup -- user committed.
    this.magicBackupFiles = {};
    this.magicBackupPreviews = {};
    this.magicExtractMode = true;
    for (const entry of log) {
      if (!entry.file || !entry.docType) continue;
      switch (entry.docType) {
        case DocumentType.SINGLE_LINE_DIAGRAM:
          this.extractSldFieldsForDevice(entry.file);
          break;
        case DocumentType.SF_02C:
          this.extractSf02cFieldsForDevice(entry.file);
          break;
        case DocumentType.COD_PROOF:
          this.extractCodFieldsForDevice(entry.file);
          break;
        case DocumentType.FORM_SF_02:
          this.extractSf02FieldsForDevice(entry.file);
          break;
        case DocumentType.METERING_EVIDENCE:
          this.extractMeterIdsForDevice(entry.file);
          break;
      }
    }
  }

  isAnyExtracting(): boolean {
    return (
      this.sldExtracting ||
      this.sf02cExtracting ||
      this.codExtracting ||
      this.sf02Extracting ||
      this.meterIdsExtracting
    );
  }

  hasAnyExtractionResult(): boolean {
    return !!(
      this.sldExtraction ||
      this.sf02cExtraction ||
      this.codExtraction ||
      this.sf02Extraction ||
      this.meterIdsExtraction.length
    );
  }

  collectExtractionClaims(): {
    [field: string]: Array<{ source: string; value: any; confidence: number }>;
  } {
    const claims: {
      [field: string]: Array<{ source: string; value: any; confidence: number }>;
    } = {};
    const add = (
      field: string,
      source: string,
      raw: { value: any; confidence: number } | undefined,
      transform?: (v: any) => any,
    ) => {
      if (!raw || raw.confidence < 0.7) return;
      if (!claims[field]) claims[field] = [];
      claims[field].push({
        source,
        value: transform ? transform(raw.value) : raw.value,
        confidence: raw.confidence,
      });
    };
    // After collecting extractor claims, also surface the form's
    // current value as a "Current" source so the conflict panel
    // lets the user keep what's already there. Only added for
    // fields that have at least one extractor claim — no point
    // showing a conflict on a field nobody is trying to change.
    const addCurrent = (field: string) => {
      if (!claims[field]?.length) return;
      const ctl = this.updateDeviceForm.get(field);
      if (!ctl) return;
      const v = ctl.value;
      if (v === null || v === undefined || v === '') return;
      claims[field].push({ source: 'Current', value: v, confidence: 1.0 });
    };
    const sld = this.sldExtraction;
    if (sld) {
      add('capacity', 'SLD', sld.acCapacityKw);
      add('generatingUnitCount', 'SLD', sld.inverterCount);
      add('interconnectionVoltage', 'SLD', sld.gridVoltage);
      add('gridInterconnection', 'SLD', sld.gridTied, (v) =>
        v ? 'true' : 'false',
      );
      add('dataSourceBrand', 'SLD', sld.inverterMakeModel);
    }
    const sf02c = this.sf02cExtraction;
    if (sf02c) {
      add('siteName', 'SF-02c', sf02c.projectName);
      add('pvSystemOwner', 'SF-02c', sf02c.ownerLegalName);
      add('address', 'SF-02c', sf02c.ownerAddress);
      add('countryCodename', 'SF-02c', sf02c.ownerCountry);
    }
    const cod = this.codExtraction;
    if (cod) {
      add('commissioningDate', 'COD', cod.commissioningDate);
      add('siteName', 'COD', cod.facilityName);
      add('capacity', 'COD', cod.acCapacityKw);
      add('pvSystemOwner', 'COD', cod.ownerName);
    }
    const sf02 = this.sf02Extraction;
    if (sf02) {
      add('siteName', 'SF-02', sf02.facilityName);
      add('capacity', 'SF-02', sf02.acCapacityKw);
      add('commissioningDate', 'SF-02', sf02.commissioningDate);
      add('deviceTypeCode', 'SF-02', sf02.deviceTypeCode);
      add('pvSystemOwner', 'SF-02', sf02.ownerLegalName);
      add('address', 'SF-02', sf02.ownerAddress);
      add('countryCodename', 'SF-02', sf02.ownerCountry);
      add('latitude', 'SF-02', sf02.latitude);
      add('longitude', 'SF-02', sf02.longitude);
      add('generatingUnitCount', 'SF-02', sf02.inverterCount);
    }
    for (const field of Object.keys(claims)) addCurrent(field);
    return claims;
  }

  getConflicts(): {
    [field: string]: Array<{ source: string; value: any; confidence: number }>;
  } {
    const claims = this.collectExtractionClaims();
    const out: typeof claims = {};
    for (const [field, list] of Object.entries(claims)) {
      if (list.length < 2) continue;
      const norm = (v: any) => {
        if (typeof v === 'number') return Number(v.toFixed(2));
        if (typeof v === 'string') return v.trim().toLowerCase();
        return v;
      };
      const distinct = new Set(list.map((c) => JSON.stringify(norm(c.value))));
      if (distinct.size > 1) out[field] = list;
    }
    return out;
  }

  hasConflicts(): boolean {
    return Object.keys(this.getConflicts()).length > 0;
  }

  setConflictPick(field: string, source: string): void {
    this.conflictPicks[field] = source;
  }

  isConflictPickSelected(
    field: string,
    source: string,
    list: Array<{ source: string; confidence: number }>,
  ): boolean {
    const picked = this.conflictPicks[field];
    if (picked) return picked === source;
    const top = [...list].sort((a, b) => b.confidence - a.confidence)[0];
    return top?.source === source;
  }

  fieldLabel(field: string): string {
    const labels: { [k: string]: string } = {
      capacity: '(9) Total AC Capacity (kW)',
      generatingUnitCount: '(13) Number of generating units',
      interconnectionVoltage: '(18) Interconnection voltage',
      gridInterconnection: '(15) Grid-connected?',
      dataSourceBrand: '(27) Data Source Brand Name',
      siteName: 'Site name',
      pvSystemOwner: 'PV system owner',
      address: 'Address',
      countryCodename: 'Country',
      commissioningDate: 'Commissioning date',
      deviceTypeCode: 'Device type code',
      latitude: 'Latitude',
      longitude: 'Longitude',
    };
    return labels[field] ?? field;
  }

  applyAllExtracted(): void {
    const claims = this.collectExtractionClaims();
    const picks = this.conflictPicks;
    for (const [field, list] of Object.entries(claims)) {
      const ctl = this.updateDeviceForm.get(field);
      if (!ctl) continue;
      // Multi-source case: user picked, or default to highest
      // confidence (which is "Current" at 1.0 when the form already
      // had a value, so we won't overwrite by accident).
      if (list.length > 1) {
        const pickedSource = picks[field];
        const chosen =
          (pickedSource && list.find((c) => c.source === pickedSource)) ||
          [...list].sort((a, b) => b.confidence - a.confidence)[0];
        if (chosen.source === 'Current') continue; // keep what's there
        ctl.setValue(chosen.value);
        ctl.markAsDirty();
        continue;
      }
      // Single-source case: patch-empty-only (don't overwrite manual
      // input the user typed before clicking Apply).
      const current = String(ctl.value ?? '').trim();
      if (current) continue;
      ctl.setValue(list[0].value);
      ctl.markAsDirty();
    }
    if (
      claims['generatingUnitCount']?.length ||
      claims['dataSourceBrand']?.length
    ) {
      this.setDataSourceIfEmpty('Inverter');
    }
    if (this.meterIdsExtraction.length) {
      this.applyMeterIdsExtraction();
    }
    this.toastrService.success('Extracted fields applied to the form');
    this.dismissMagicExtraction();
  }

  dismissMagicExtraction(): void {
    this.magicLog = [];
    this.magicExtractMode = false;
    this.sldExtraction = null;
    this.sf02cExtraction = null;
    this.codExtraction = null;
    this.sf02Extraction = null;
    this.meterIdsExtraction = [];
    this.meterIdsBrand = '';
    this.conflictPicks = {};
  }

  private classifyUploadedFile(file: File, currentType: string): void {
    this.classifying[currentType] = true;
    this.classificationSuggestions[currentType] = null;

    this.documentClassifier.classify(file).subscribe({
      next: (result) => {
        this.ngZone.run(() => {
          this.classifying[currentType] = false;
          if (
            result &&
            result.suggestedType !== currentType &&
            result.confidence >= 0.4
          ) {
            this.classificationSuggestions[currentType] = result;
          }
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.classifying[currentType] = false;
        });
      },
    });
  }

  acceptClassification(fromType: string): void {
    const suggestion = this.classificationSuggestions[fromType];
    if (!suggestion) return;

    const toType = suggestion.suggestedType as string;
    const filesInSlot = this.files[fromType];
    if (!filesInSlot?.length) return;

    if (!this.files[toType]) this.files[toType] = [];
    this.files[toType] = [...this.files[toType], ...filesInSlot];
    this.files[fromType] = [];

    if (this.filePreviews[fromType]) {
      this.filePreviews[toType] = this.filePreviews[fromType];
      delete this.filePreviews[fromType];
    }

    this.classificationSuggestions[fromType] = null;
  }

  dismissClassification(fileType: string): void {
    this.classificationSuggestions[fileType] = null;
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

  viewMagicFile(file: File): void {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isImage = file.type.startsWith('image/');
    const isPdf = ext === 'pdf';
    const isExcel = ext === 'xlsx' || ext === 'xls';
    const objUrl = URL.createObjectURL(file);
    this.previewData = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(objUrl),
      type: isImage ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : 'other',
      name: file.name,
    };
    this.currentPreviewFile = file;
    this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'file-preview-dialog',
    });
  }

  openRenameDialog(docType: string): void {
    const docs = this.existingDocs[docType];
    if (!docs?.length) return;
    this.renameDialogType = docType;
    this.renameDialogDraft = docs.map((d) => d.label ?? '');
    this.renameDialogRef = this.dialog.open(this.renameDialogTemplate, {
      width: '1200px',
      maxWidth: '95vw',
      maxHeight: '92vh',
      disableClose: true,
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
    const type: 'image' | 'pdf' | 'excel' | 'other' = this.isPdfFile(d.name)
      ? 'pdf'
      : ext === 'xlsx' || ext === 'xls'
        ? 'excel'
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
    // D-REC requires ≥6 decimals on lat/lng (≈10cm precision). Block
    // edits that would push a device into review with fail-precision
    // already baked in; force the registrant to drag the satellite-map
    // pin onto the panels (which writes high-precision coords via
    // map.getCenter()).
    const dec = (v: any): number => {
      const s = v == null ? '' : String(v);
      const i = s.indexOf('.');
      return i < 0 ? 0 : s.length - i - 1;
    };
    const latVal = this.updateDeviceForm.value.latitude;
    const lngVal = this.updateDeviceForm.value.longitude;
    if (dec(latVal) < 6 || dec(lngVal) < 6) {
      this.toastrService.error(
        'Lat/lng need at least 6 decimals (≈10 cm precision). Drag the satellite-map pin onto the panels.',
        'Coordinates too imprecise',
        { timeOut: 8000 },
      );
      return;
    }

    const selectedCountry: CountryInfo | undefined = this.countrylist.find(
      (option) => option.country === this.updateDeviceForm.value.countryCode,
    );
    this.updateDeviceForm.controls['organizationId'].setValue(
      this.organizationId ?? this.loginuser?.organizationId,
    );
    if (this.updateDeviceForm.controls['serialNumber'].value == null) {
      this.updateDeviceForm.controls['serialNumber'].setValue(
        this.serialNumber,
      );
    }
    this.updateDeviceForm.controls['countryCode'].setValue(
      selectedCountry?.alpha3,
    );

    // Capture the form value once — .value returns a new snapshot each call
    const formValue = this.updateDeviceForm.value;

    // Truncate lat/long to 9 decimal places (backend regex limit)
    if (formValue.latitude) {
      const [intLat, decLat] = String(formValue.latitude).split('.');
      formValue.latitude = decLat ? `${intLat}.${decLat.slice(0, 20)}` : intLat;
    }
    if (formValue.longitude) {
      const [intLng, decLng] = String(formValue.longitude).split('.');
      formValue.longitude = decLng
        ? `${intLng}.${decLng.slice(0, 20)}`
        : intLng;
    }

    // OC#37 is a multi-select in the UI but stored as a '; '-joined string
    if (Array.isArray(formValue.labellingSchemeAccreditation)) {
      formValue.labellingSchemeAccreditation =
        formValue.labellingSchemeAccreditation.join('; ') || null;
    }

    // Partial-update support: strip null/undefined/''/NaN keys so the
    // backend's skipMissingProperties skips them (IsOptional alone only
    // covers null/undefined — a null → Transform → NaN still fails IsNumber).
    for (const k of Object.keys(formValue)) {
      const v = (formValue as any)[k];
      if (
        v === null ||
        v === undefined ||
        v === '' ||
        (typeof v === 'number' && isNaN(v))
      ) {
        delete (formValue as any)[k];
      }
    }

    // Check if any files were selected
    const hasFiles = this.fileTypes.some((ft) => this.files[ft]?.length > 0);

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
        this.updateDeviceForm.controls['serialNumber'].value !==
          this.initSerialNumber,
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
  isGeneratingSf02 = false;
  generateSf02Now(): void {
    if (!this.id || this.isGeneratingSf02) return;
    this.isGeneratingSf02 = true;
    this.http
      .post(
        `${environment.API_URL}device-reviews/${this.id}/generate-sf02`,
        {},
      )
      .subscribe({
        next: () => {
          this.isGeneratingSf02 = false;
          this.toastrService.success(
            'SF-02 registration form generated',
            'SF-02',
          );
          // Refresh existing docs so the new createdAt timestamp shows up.
          this.deviceService.getDocuments(this.id).subscribe({
            next: (docs) => {
              const sf02 = docs.filter(
                (d: any) => d.type === DocumentType.FORM_SF_02,
              );
              this.existingDocs[DocumentType.FORM_SF_02] = sf02.map(
                (doc: any) => ({
                  url: doc.url,
                  name: doc.originalFilename || `SF02-${this.externalid}.pdf`,
                  id: doc.id,
                  label: doc.label,
                  createdAt: doc.createdAt,
                }),
              );
            },
            error: () => {},
          });
        },
        error: (err) => {
          this.isGeneratingSf02 = false;
          this.toastrService.error(
            err?.error?.message || err?.message || 'Generation failed',
            'SF-02',
          );
        },
      });
  }
  /** Returns the createdAt of the latest FORM_SF_02 doc for this device, if any. */
  sf02LatestGeneratedAt(): string | null {
    const docs = this.existingDocs['FORM_SF_02'] || [];
    if (!docs.length) return null;
    const sorted = [...docs].sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || ''),
    );
    return sorted[0].createdAt || null;
  }
  reset() {
    if (this.frombulk) {
      this.router.navigate(['/device/bulk_upload']);
    } else {
      this.router.navigate(['/device/AllList']);
    }
  }

  /** Handle tab-separated lat/long paste from spreadsheets (e.g. "1.23\t4.56"). */
  onCoordPaste(event: ClipboardEvent, field: 'latitude' | 'longitude'): void {
    const text = event.clipboardData?.getData('text') ?? '';
    const parts = text.split(/\t/);
    if (parts.length >= 2) {
      event.preventDefault();
      const [lat, lng] = field === 'latitude' ? parts : [parts[1], parts[0]];
      this.updateDeviceForm.get('latitude')?.setValue(lat.trim());
      this.updateDeviceForm.get('longitude')?.setValue(lng.trim());
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
    // Update the form (the source of truth). Don't touch this.latitude /
    // this.longitude — those component properties are bound via [(ngModel)]
    // alongside formControlName, and writing them triggers a deferred
    // ngModel-driven setValue on the next CD pass that fires valueChanges
    // with mapCenterUpdating already cleared, which would reset coordsDirty.
    this.updateDeviceForm
      .get('latitude')
      ?.setValue(center.lat, { emitEvent: false });
    this.updateDeviceForm
      .get('longitude')
      ?.setValue(center.lng, { emitEvent: false });
    const origLat = parseFloat(this.savedCoords.lat);
    const origLng = parseFloat(this.savedCoords.lng);
    this.coordsDirty = center.lat !== origLat || center.lng !== origLng;
    this.mapCenterUpdating = false;
  }

  cancelCoordChange(): void {
    if (!this.savedCoords) return;
    this.latitude = this.savedCoords.lat;
    this.longitude = this.savedCoords.lng;
    this.updateDeviceForm
      .get('latitude')
      ?.setValue(this.savedCoords.lat, { emitEvent: false });
    this.updateDeviceForm
      .get('longitude')
      ?.setValue(this.savedCoords.lng, { emitEvent: false });
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
      this.updateDeviceForm.controls['serialNumber'].setValue(
        this.serialNumber,
      );
    }
    this.updateDeviceForm.controls['countryCode'].setValue(
      selectedCountry?.alpha3,
    );

    const formValue = { ...this.updateDeviceForm.value };
    if (formValue.latitude) {
      const [intLat, decLat] = String(formValue.latitude).split('.');
      formValue.latitude = decLat ? `${intLat}.${decLat.slice(0, 20)}` : intLat;
    }
    if (formValue.longitude) {
      const [intLng, decLng] = String(formValue.longitude).split('.');
      formValue.longitude = decLng
        ? `${intLng}.${decLng.slice(0, 20)}`
        : intLng;
    }

    // OC#37 is a multi-select in the UI but stored as a '; '-joined string
    if (Array.isArray(formValue.labellingSchemeAccreditation)) {
      formValue.labellingSchemeAccreditation =
        formValue.labellingSchemeAccreditation.join('; ') || null;
    }

    this.deviceService.update(this.externalid, formValue, false).subscribe({
      next: () => {
        this.toastrService.success('Coordinates saved');
        this.savedCoords = null;
        this.coordsDirty = false;
        // Restore country display name so form still shows it correctly
        if (selectedCountry) {
          this.updateDeviceForm.controls['countryCode'].setValue(
            selectedCountry.country,
          );
        }
      },
      error: (err: any) => {
        this.toastrService.error(
          err.error?.message || 'Failed to save coordinates',
        );
        // Restore country display name on error too
        if (selectedCountry) {
          this.updateDeviceForm.controls['countryCode'].setValue(
            selectedCountry.country,
          );
        }
      },
    });
  }

  /**
   * Roboflow panel detection succeeded with ≥1 panels at these coords —
   * persist that on the device so auto-screen's ≥6-decimal precision
   * check passes. Skips if the device hasn't been saved yet.
   */
  onPanelDetected(event: { lat: number; lng: number; panelCount: number }): void {
    if (!this.id) return;
    this.deviceService
      .confirmCoords(this.id, event.lat, event.lng, event.panelCount)
      .subscribe({
        next: () => {},
        error: (err) =>
          console.warn(
            'coords-confirmed failed (non-blocking):',
            err?.error?.message || err?.message,
          ),
      });
  }

  onScreenshotFromMap(file: File): void {
    // Upload the map screenshot (with EXIF GPS) immediately as a Site Photo —
    // no need to wait for the Update button. Falls back to staging if the
    // device id isn't loaded yet (e.g. add-device flow uses a separate path).
    if (!this.id) {
      if (!this.files[DocumentType.PROJECT_PHOTOS]) {
        this.files[DocumentType.PROJECT_PHOTOS] = [];
      }
      this.files[DocumentType.PROJECT_PHOTOS].push(file);
      this.toastrService.info(
        `Map capture staged — Save to upload`,
        'Captured',
      );
      return;
    }
    this.deviceService
      .uploadSingleDocument(this.id, DocumentType.PROJECT_PHOTOS, file)
      .subscribe({
        next: (saved) => {
          if (!this.existingDocs[DocumentType.PROJECT_PHOTOS]) {
            this.existingDocs[DocumentType.PROJECT_PHOTOS] = [];
          }
          this.existingDocs[DocumentType.PROJECT_PHOTOS].push({
            url: saved.url,
            name: file.name,
            id: saved.id,
            label: null,
            createdAt: saved.createdAt,
          });
          this.toastrService.success(
            `Map capture "${file.name}" uploaded as Site Photo`,
            'Uploaded',
          );
        },
        error: (err) =>
          this.toastrService.error(
            err?.error?.message || err?.message || 'Upload failed',
            'Site Photo',
          ),
      });
  }

  updateMapMarkers(latitude: any, longitude: any) {
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const markers = [{ latitude: lat, longitude: lng }];

      if (this.mapComponent) {
        this.mapComponent.markers = [...markers];
        if (this.mapComponent.isMapInitialized) {
          this.mapComponent.update();
          if (!this.mapCenterUpdating) {
            this.mapComponent.recenter(lat, lng);
          }
        }
      }
      if (this.satelliteMapComponent) {
        this.satelliteMapComponent.markers = [...markers];
        if (this.satelliteMapComponent.isMapInitialized) {
          this.satelliteMapComponent.update();
          if (!this.mapCenterUpdating) {
            this.satelliteMapComponent.recenter(lat, lng);
          }
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
