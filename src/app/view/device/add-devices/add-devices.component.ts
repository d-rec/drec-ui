import {
  Component,
  TemplateRef,
  ViewChild,
  EventEmitter,
  Output,
  OnDestroy,
  NgZone,
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
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription, Subject } from 'rxjs';
import {
  startWith,
  map,
  debounceTime,
  distinctUntilChanged,
  switchMap,
} from 'rxjs/operators';
import {
  OrganizationInformation,
  fulecodeType,
  devicecodeType,
  CountryInfo,
} from '../../../models';
import { postcodeValidator } from '../../../utils/validate-postcode';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  DocumentType,
  DataSourceTypes,
  OrganizationType,
  OperatingConfiguration,
  SourceAccessMode,
  RegistrationType,
  VolumeEvidenceType,
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

export type DeviceFiles = {
  [DocumentType.FORM_SF_02]: File[];
  [DocumentType.SF_02C]: File[];
  [DocumentType.PROOF_OF_OWNERSHIP]: File[];
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
  currentPreviewDocType: string | null = null;
  DataSourceTypes = DataSourceTypes;
  DocumentType = DocumentType;
  operatingConfigurations = Object.values(OperatingConfiguration);
  sourceAccessModes = Object.values(SourceAccessMode);
  labellingSchemes = LABELLING_SCHEMES;
  registrationTypes = Object.values(RegistrationType);
  volumeEvidenceTypes = Object.values(VolumeEvidenceType);
  evidenceReqs: EvidenceRequirements = getEvidenceRequirements(null);

  /** AI document classification suggestions per device/fileType. */
  classificationSuggestions: {
    [deviceIndex: number]: { [fileType: string]: ClassificationResult | null };
  } = {};
  classifying: { [deviceIndex: number]: { [fileType: string]: boolean } } = {};
  DOCUMENT_TYPE_LABELS = DOCUMENT_TYPE_LABELS;

  /** SLD vision extraction state per device. */
  sldExtractions: { [deviceIndex: number]: SldExtractedFields | null } = {};
  sldExtracting: { [deviceIndex: number]: boolean } = {};

  /** SF-02c text/vision extraction state per device. */
  sf02cExtractions: { [deviceIndex: number]: Sf02cExtractedFields | null } = {};
  sf02cExtracting: { [deviceIndex: number]: boolean } = {};

  /** COD proof extraction state per device. */
  codExtractions: { [deviceIndex: number]: CodExtractedFields | null } = {};
  codExtracting: { [deviceIndex: number]: boolean } = {};

  /** SF-02 (registration form) extraction state per device. */
  sf02Extractions: { [deviceIndex: number]: Sf02ExtractedFields | null } = {};
  sf02Extracting: { [deviceIndex: number]: boolean } = {};

  /** Aggregated measurement IDs harvested from any number of metering
   *  screenshots / nameplate photos / COD proofs. Each upload appends
   *  its results so the user sees the running list. */
  meterIdsExtractions: { [deviceIndex: number]: string[] } = {};
  meterIdsBrands: { [deviceIndex: number]: string } = {};
  meterIdsExtracting: { [deviceIndex: number]: boolean } = {};

  /** Auto-classifier extraction phase. When true, the magic-overlay
   *  dialog shows the consolidated extraction view (running spinner +
   *  preview list + single Apply All button) instead of the
   *  classification table. Set by "OK + Extract", cleared on Apply
   *  All / Cancel. */
  magicExtractMode: { [deviceIndex: number]: boolean } = {};

  /** When multiple sources claim different values for the same form
   *  field, the user picks one in the dialog. Maps form-control name
   *  → chosen source label. */
  conflictPicks: { [deviceIndex: number]: { [field: string]: string } } = {};

  /** Name of the file currently being processed in Phase 1 (sort).
   *  Surfaced below the progress bar so the user sees liveness. */
  magicCurrentFile: { [deviceIndex: number]: string | null } = {};
  /** Substep within the current file (e.g. "OCR on image (slow)…"). */
  magicCurrentStep: { [deviceIndex: number]: string | null } = {};

  /** Magic auto-sort state. */
  magicRunning: { [deviceIndex: number]: boolean } = {};
  magicDone: { [deviceIndex: number]: number } = {};
  magicTotal: { [deviceIndex: number]: number } = {};
  magicLog: {
    [deviceIndex: number]: Array<{
      filename: string;
      target: string;
      confidence: number | null;
      type: 'hit' | 'miss';
      file?: File;
      docType?: string; // populated for hit rows so post-sort extraction
                       // can route the file to the right extractor.
    }>;
  } = {};
  private magicBackupFiles: { [deviceIndex: number]: any } = {};
  private magicBackupPreviews: { [deviceIndex: number]: any } = {};

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
  // Per-row state for the Save & Generate SF-02 flow. After a row is
  // saved this way it carries the new device id and the timestamp of
  // the latest auto-generated SF-02; bulk Submit then skips it.
  savedDeviceIdByIndex: Record<number, number> = {};
  isGeneratingSf02ByIndex: Record<number, boolean> = {};
  sf02GeneratedAtByIndex: Record<number, string> = {};
  requiredFileTypes: FileType[] = [
    DocumentType.FORM_SF_02,
    DocumentType.SF_02C,
    DocumentType.PROOF_OF_OWNERSHIP,
    DocumentType.METERING_EVIDENCE,
    DocumentType.SINGLE_LINE_DIAGRAM,
    DocumentType.PROJECT_PHOTOS,
    DocumentType.COD_PROOF,
  ];
  @ViewChild('streetMap') mapComponent: MapComponent;
  @ViewChild('satelliteMap') satelliteMapComponent: MapComponent;
  @Output() zoom = new EventEmitter<number>();

  /** When the route is /device/edit/:id, the same component runs in
   *  edit mode: hydrates the first FormArray row from the existing
   *  device, hides the "+ Add Device" button, switches the submit
   *  path to PATCH. When undefined the component behaves as the
   *  classic multi-row Add flow. */
  editingExternalId: string | null = null;
  /** Numeric id once the device has been loaded — extractors use it
   *  for ai_audit_log per-device tracking. */
  editingDeviceId: number | null = null;

  /** Existing server-saved docs for the device being edited, keyed by
   *  device-row index → docType. Add-flow keeps this empty; edit-flow
   *  populates it for index 0 from getDocuments(). */
  existingDocs: {
    [deviceIndex: number]: {
      [type: string]: {
        url: string;
        name: string;
        id: number;
        label: string | null;
        createdAt?: string;
      }[];
    };
  } = {};
  brokenDocs: { [deviceIndex: number]: { [type: string]: boolean } } = {};
  /** Initial serial number observed at hydration time so we can flag
   *  changes for the PATCH `serialNumberChanged` query param. */
  private initSerialNumber: string | null = null;
  private initSiteName: string | null = null;

  get isEditMode(): boolean {
    return this.editingExternalId !== null;
  }

  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private router: Router,
    private route: ActivatedRoute,
    private toastrService: ToastrService,
    private adminService: AdminService,
    private orgService: OrganizationService,
    public dialog: MatDialog,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private documentClassifier: DocumentClassifierService,
    private ngZone: NgZone,
  ) {
    this.user = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {
    this.editingExternalId = this.route.snapshot.paramMap.get('id');
    this.loadData();
    this.initializeForm();
    this.showerror[0] = false;
    this.siteNameExists[0] = false;

    this.deviceForms.controls.forEach((group, i) => {
      this.setupdataSourceBrandWatcher(group as FormGroup);
      this.setupDataSourceWatcher(group as FormGroup);
      this.setupSiteNameWatcher(group as FormGroup, i);
      this.setupImpactStoryWatcher(group as FormGroup);
    });

    if (this.isEditMode) {
      // Defer until country/SDG/fuel/device-type lookups land — the
      // hydration step needs them to translate codes into the form's
      // display values. Poll briefly; loadData() kicks all four off in
      // parallel so they typically resolve in <100ms.
      const start = Date.now();
      const wait = (): void => {
        if (
          this.countrylist?.length &&
          this.sdgblist &&
          this.fuellist?.length &&
          this.devicetypelist?.length
        ) {
          this.loadDeviceForEdit();
        } else if (Date.now() - start < 8000) {
          setTimeout(wait, 100);
        } else {
          // Lookups still missing — try anyway; fields that depend on
          // them will show the raw code instead of the display value.
          this.loadDeviceForEdit();
        }
      };
      wait();
    }
  }

  /**
   * Edit-mode hydration. Pulls the existing device by externalId and
   * patches the first FormArray row with its values, then loads its
   * server-saved documents into existingDocs[0]. Mirrors edit-device's
   * old getDeviceinfo() / getDocuments() flow.
   */
  private loadDeviceForEdit(): void {
    if (!this.editingExternalId) return;
    this.deviceService
      .getDeviceInfoBYexternalId(this.editingExternalId)
      .subscribe({
        next: (data: any) => {
          this.editingDeviceId = data.id;
          this.initSerialNumber = data.serialNumber ?? null;
          this.initSiteName = data.siteName ?? null;

          const firstRow = this.deviceForms.at(0) as FormGroup;
          if (!firstRow) return;

          // Map alpha3 country code → display name for the autocomplete.
          const countryName = this.countrylist.find(
            (c: any) => c.alpha3 === data.countryCode,
          )?.country ?? data.countryCode;

          // SDGBenefits storage uses the value but the UI binds on name.
          let sdgBenefitNames: string[] = [];
          if (Array.isArray(data.SDGBenefits) && this.sdgblist) {
            sdgBenefitNames = data.SDGBenefits.map((sdgValue: string) => {
              const found = (this.sdgblist as any[]).find(
                (ele: any) =>
                  ele.value?.toString().toLowerCase() ===
                  String(sdgValue).toLowerCase(),
              );
              return found?.name ?? sdgValue;
            });
          }

          // OC#37 labelling-scheme accreditation: stored as '; '-joined string,
          // form expects an array.
          const labellingSchemeArr: string[] = data.labellingSchemeAccreditation
            ? String(data.labellingSchemeAccreditation)
                .split(/\s*;\s*/)
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [];

          firstRow.patchValue({
            siteName: data.siteName,
            serialNumber: data.serialNumber,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            countryCodename: countryName,
            fuelCode: data.fuelCode,
            deviceTypeCode: data.deviceTypeCode,
            capacity: data.capacity,
            commissioningDate: data.commissioningDate,
            gridInterconnection: data.gridInterconnection,
            operatingConfiguration: data.operatingConfiguration ?? null,
            sourceAccessMode: data.sourceAccessMode ?? null,
            offTaker: data.offTaker,
            impactStory: data.impactStory,
            deviceDescription: data.deviceDescription,
            stateProvince: data.stateProvince,
            postcode: data.postcode,
            SDGBenefits: sdgBenefitNames,
            labellingSchemeAccreditation: labellingSchemeArr,
            version: data.version ?? '1.0',
            defaultAccountCode: data.defaultAccountCode,
            requestedEffectiveRegDate: data.requestedEffectiveRegDate,
            signatoryName: data.signatoryName,
            gridExportType: data.gridExportType,
            hasNetworkMeter: data.hasNetworkMeter,
            meterReadsShareable: data.meterReadsShareable,
            hasCaptiveConsumer: data.hasCaptiveConsumer,
            hasAuxiliaryEnergySources: data.hasAuxiliaryEnergySources,
            auxiliaryEnergySourceDetails: data.auxiliaryEnergySourceDetails,
            nonMeterImportDetails: data.nonMeterImportDetails,
            otherEacSchemeRegistration: data.otherEacSchemeRegistration,
            additionalInfo: data.additionalInfo,
            generatingUnitCount: data.generatingUnitCount,
            networkOwner: data.networkOwner,
            interconnectionVoltage: data.interconnectionVoltage,
            pvSystemOwner: data.pvSystemOwner,
            offTakerName: data.offTakerName,
            offTakerSameCompanyAsOwner: data.offTakerSameCompanyAsOwner,
            hasSubsidy: data.hasSubsidy,
            subsidyTypes: data.subsidyTypes ?? [],
            subsidyOtherDetails: data.subsidyOtherDetails,
            subsidyClaimsEacs: data.subsidyClaimsEacs,
            hasPublicFunding: data.hasPublicFunding,
            publicFundingEndDate: data.publicFundingEndDate,
            registrationType: data.registrationType,
            volumeEvidenceType: data.volumeEvidenceType,
            verificationAgentName: data.verificationAgentName,
            offGridCircumstances: data.offGridCircumstances,
            dataSource: data.dataSource,
            dataSourceBrand: data.dataSourceBrand,
            otherDataSource: data.otherDataSource,
          });

          this.organizationId = data.organizationId ?? this.organizationId;

          // Refresh evidence-requirements off the loaded operating config.
          this.evidenceReqs = getEvidenceRequirements(
            data.operatingConfiguration ?? null,
          );

          // Re-seed serial-number list from joined string.
          this.serialNumberLists[0] = data.serialNumber
            ? String(data.serialNumber).split(/\s*;\s*/)
            : [''];

          // Load existing docs for this device (single-row, so always index 0).
          this.deviceService.getDocuments(data.id).subscribe({
            next: (docs) => {
              const docsByType: {
                [type: string]: {
                  url: string;
                  name: string;
                  id: number;
                  label: string | null;
                  createdAt?: string;
                }[];
              } = {};
              for (const doc of docs) {
                if (!docsByType[doc.type]) docsByType[doc.type] = [];
                let name =
                  doc.url.split('/').pop()?.split('?')[0] || doc.type;
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
                name = name.replace(
                  /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
                  '',
                );
                name = name.replace(/_\d{10,}_\d+\./, '.');
                docsByType[doc.type].push({
                  url: doc.url,
                  name: doc.originalFilename || name,
                  id: doc.id,
                  label: doc.label,
                  createdAt: doc.createdAt,
                });
              }
              for (const t of Object.keys(docsByType)) {
                docsByType[t].sort((a, b) =>
                  (a.label || a.name).localeCompare(b.label || b.name, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                  }),
                );
              }
              this.existingDocs[0] = docsByType;

              // Probe each URL for 404s so the UI can flag broken links.
              this.brokenDocs[0] = {};
              for (const type of Object.keys(docsByType)) {
                for (const doc of docsByType[type]) {
                  if (!doc.url) {
                    this.brokenDocs[0][type] = true;
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
                      if (!res.ok) this.brokenDocs[0][type] = true;
                    },
                    (err) => {
                      if (err?.name !== 'AbortError')
                        this.brokenDocs[0][type] = true;
                    },
                  );
                }
                // Pre-populate filePreviews so View buttons render for
                // existing docs even before the user touches the file
                // input.
                if (
                  !this.filePreviews[0]?.[type] &&
                  docsByType[type]?.length
                ) {
                  const doc = docsByType[type][0];
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
                  if (!this.filePreviews[0]) this.filePreviews[0] = {};
                  this.filePreviews[0][type] = {
                    url: this.sanitizer.bypassSecurityTrustResourceUrl(
                      doc.url,
                    ),
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
            },
            error: () => {},
          });
        },
        error: (err: any) => {
          this.toastrService.error(
            err?.error?.message || err?.message || 'Failed to load device',
            'Edit',
          );
        },
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
      labellingSchemeAccreditation: [['The D-REC Label']],
      verificationAgentName: [null],
      offGridCircumstances: [null],
      FORM_SF_02: [null],
      SF_02C: [null],
      PROOF_OF_OWNERSHIP: [null],
      METERING_EVIDENCE: [null],
      SINGLE_LINE_DIAGRAM: [null],
      PROJECT_PHOTOS: [null],
      COD_PROOF: [null],
      OTHER_DOCUMENTS: [null],
      sf02EvidenceMode: ['self'],
    });

    device.get('latitude')?.valueChanges.subscribe((v: any) => {
      const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
      if (stripped !== v)
        device.get('latitude')?.setValue(stripped, { emitEvent: false });
      const longitude = device.get('longitude')?.value;
      this.updateMapMarkers(stripped, longitude);
    });
    device.get('longitude')?.valueChanges.subscribe((v: any) => {
      const stripped = typeof v === 'string' ? v.replace(/\s/g, '') : v;
      if (stripped !== v)
        device.get('longitude')?.setValue(stripped, { emitEvent: false });
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
      labellingSchemeAccreditation: [['The D-REC Label']],
      verificationAgentName: [null],
      offGridCircumstances: [null],
      FORM_SF_02: [null],
      SF_02C: [null],
      PROOF_OF_OWNERSHIP: [null],
      METERING_EVIDENCE: [null],
      SINGLE_LINE_DIAGRAM: [null],
      PROJECT_PHOTOS: [null],
      COD_PROOF: [null],
      OTHER_DOCUMENTS: [null],
      sf02EvidenceMode: ['self'],
    });

    this.deviceForms.push(device);
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
    this.setupImpactStoryWatcher(device);
  }

  /**
   * Infer (8) Device Description from free-text impactStory keywords.
   * Only patches when the dropdown is empty so a deliberate user
   * choice survives. Vocabulary matches the devicedescription enum.
   */
  private setupImpactStoryWatcher(deviceGroup: FormGroup): void {
    const apply = (text: string | null | undefined) => {
      const setIfEmpty = (name: string, val: any) => {
        const ctl = deviceGroup.get(name);
        if (!ctl || ctl.value || val == null) return;
        ctl.setValue(val);
        ctl.markAsDirty();
      };
      setIfEmpty('deviceDescription', this.inferDeviceDescription(text));
      setIfEmpty('offTaker', this.inferOffTaker(text));
      const funding = this.inferFundingFlags(text);
      if (funding) {
        setIfEmpty('hasPublicFunding', funding.publicFunding);
        setIfEmpty('hasSubsidy', funding.subsidy);
      }
      // SDG benefits: only patch if currently empty (multi-select).
      const sdgCtl = deviceGroup.get('SDGBenefits');
      const cur = sdgCtl?.value;
      if (sdgCtl && (!Array.isArray(cur) || cur.length === 0)) {
        const inferred = this.inferSdgBenefits(text);
        if (inferred.length) {
          sdgCtl.setValue(inferred);
          sdgCtl.markAsDirty();
        }
      }
    };
    // Run on initial value (covers edit-mode hydration) and on changes.
    apply(deviceGroup.get('impactStory')?.value);
    deviceGroup
      .get('impactStory')
      ?.valueChanges.pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(apply);
  }

  /**
   * Infer (off-taker dropdown) from impactStory free text. Strategy:
   *   1. Look for "<count> <category>" patterns ("369 residential
   *      users", "31 commercial customers"). Pick the category with
   *      the highest count — this captures the typical mini-grid
   *      breakdown ("400 connections, 369 residential, 31 commercial"
   *      → Residential).
   *   2. Fall back to keyword presence if no counts are written.
   * Vocabulary mirrors the offtaker enum so the value drops straight
   * into the dropdown.
   */
  /**
   * Infer applicable SDG codes (SDG1..SDG17) from impactStory text.
   * Keyword-driven; permissive — adds an SDG only when an explicit
   * cue is present. Solar generation projects always get SDG7
   * (Affordable & Clean Energy) and SDG13 (Climate Action) since
   * those are baked into the D-REC value proposition.
   */
  private inferSdgBenefits(text: string | null | undefined): string[] {
    if (!text || !text.trim()) return [];
    const t = text.toLowerCase();
    const hits: string[] = [];
    const map: Array<{ sdg: string; re: RegExp }> = [
      { sdg: 'SDG1', re: /\b(poverty|livelihood|income|low[-\s]income|household income)\b/ },
      { sdg: 'SDG2', re: /\b(food security|hunger|agricultur|farm(ing|s)?|crop yield|irrigation)\b/ },
      { sdg: 'SDG3', re: /\b(health|clinic(s)?|hospital(s)?|vaccin|cold chain|maternal|disease)\b/ },
      { sdg: 'SDG4', re: /\b(school(s)?|education|student(s)?|literacy|classroom|teacher(s)?|learning)\b/ },
      { sdg: 'SDG5', re: /\b(gender|women[-\s]?(led|owned)?|female entrepreneur|girls?\b)/ },
      { sdg: 'SDG6', re: /\b(clean water|water pump|sanitation|hygiene|wash\b)/ },
      // SDG7 and SDG13 are baked-in for any solar project — see below.
      { sdg: 'SDG8', re: /\b(jobs?|employ|economic growth|decent work|sme(s)?|smb(s)?|micro[-\s]enterprise)\b/ },
      { sdg: 'SDG9', re: /\b(infrastructur|industr|mini[-\s]?grid|connectivity|digital access|innovation)\b/ },
      { sdg: 'SDG10', re: /\b(rural|underserved|marginalised|marginalized|last[-\s]mile|equity|inclusion|inequality)\b/ },
      { sdg: 'SDG11', re: /\b(community|urban|city|cities|sustainable cities|housing)\b/ },
      { sdg: 'SDG12', re: /\b(responsible consumption|circular|waste reduction|sustainable production)\b/ },
      { sdg: 'SDG14', re: /\b(marine|ocean|coastal|fisheries)\b/ },
      { sdg: 'SDG15', re: /\b(biodiversity|forest(s)?|reforestation|land degradation|wildlife)\b/ },
      { sdg: 'SDG16', re: /\b(governance|peace|justice|institutions|transparency)\b/ },
      { sdg: 'SDG17', re: /\b(partnership(s)?|public[-\s]private|multi[-\s]stakeholder)\b/ },
    ];
    for (const { sdg, re } of map) {
      if (re.test(t)) hits.push(sdg);
    }
    // Always-on for solar generation.
    if (!hits.includes('SDG7')) hits.unshift('SDG7');
    if (!hits.includes('SDG13')) hits.push('SDG13');
    return hits;
  }

  /**
   * Detect explicit mentions of public funding / subsidy in the
   * impact story. Conservative — only fires "Yes" when the text
   * explicitly names a programme/subsidy. Doesn't set "No" because
   * absence of evidence isn't evidence of absence.
   */
  private inferFundingFlags(
    text: string | null | undefined,
  ): { publicFunding: 'Yes' | null; subsidy: 'Yes' | null } | null {
    if (!text) return null;
    const t = text.toLowerCase();
    const publicSignals = [
      // Multilateral / DFI funders
      /\b(world\s*bank|ifc\b|afdb|adb\b|eib\b|undp|usaid|gef\b|green\s*climate\s*fund|gcf\b)/,
      // Bilaterals
      /\b(dfid|fcdo|giz\b|kfw|sida|norad|aecid|jica|gpe\b)/,
      // EU / national grants
      /\b(eu[-\s]funded|european\s*union\s*funded|horizon\s*europe|nepa\b|nigeria\s*electrification\s*project)/,
      // Generic
      /\bgrant[-\s]?funded\b|\bgovernment\s*grant\b|\bpublic\s*funding\b|\bgrant\s*from\b/,
    ];
    const subsidySignals = [
      /\bsubsid(y|ies|ised|ized)\b/,
      /\btariff\s*support\b/,
      /\bresult[-\s]based\s*financing\b|\brbf\b/,
      /\bfeed[-\s]in\s*tariff\b/,
      /\bcapex\s*grant\b|\bcapital\s*subsidy\b/,
    ];
    const hasPub = publicSignals.some((re) => re.test(t));
    const hasSub = subsidySignals.some((re) => re.test(t));
    if (!hasPub && !hasSub) return null;
    return {
      publicFunding: hasPub ? 'Yes' : null,
      subsidy: hasSub ? 'Yes' : null,
    };
  }

  private inferOffTaker(text: string | null | undefined): string | null {
    if (!text) return null;
    const t = text.toLowerCase();
    const cats: Array<{ key: string; re: RegExp; countRe: RegExp }> = [
      { key: 'School', re: /\bschool(s)?\b/, countRe: /(\d[\d,]*)\s*school/g },
      { key: 'Education', re: /\beducation\b/, countRe: /(\d[\d,]*)\s*education/g },
      { key: 'Health Facility', re: /\b(health\s+facilit(y|ies)|clinic(s)?|hospital(s)?)\b/, countRe: /(\d[\d,]*)\s*(health|clinic|hospital)/g },
      { key: 'Residential', re: /\b(resident(ial|s)?|household(s)?|home(s)?)\b/, countRe: /(\d[\d,]*)\s*(resident|household|home|user)/g },
      { key: 'Commercial', re: /\b(commercial|business(es)?|shop(s)?|merchant(s)?)\b/, countRe: /(\d[\d,]*)\s*(commercial|business|shop|merchant)/g },
      { key: 'Industrial', re: /\b(industrial|factor(y|ies)|industry)\b/, countRe: /(\d[\d,]*)\s*(industrial|factor|industry)/g },
      { key: 'Public Sector', re: /\bpublic sector\b|\bgovernment building/, countRe: /(\d[\d,]*)\s*public/g },
      { key: 'Agriculture', re: /\b(agricultur|farm(s|ing)?|irrigation)\b/, countRe: /(\d[\d,]*)\s*(farm|agricultur)/g },
      { key: 'Utility', re: /\butilit(y|ies)\b|\bdisco\b/, countRe: /(\d[\d,]*)\s*utilit/g },
      { key: 'Off-Grid Community', re: /\boff[\s-]?grid\s+communit(y|ies)\b/, countRe: /(\d[\d,]*)\s*off[\s-]?grid/g },
    ];

    // Pass 1: count-based ranking
    const counts: Array<{ key: string; n: number }> = [];
    for (const c of cats) {
      let total = 0;
      for (const m of t.matchAll(c.countRe)) {
        total += parseInt(m[1].replace(/,/g, ''), 10) || 0;
      }
      if (total > 0) counts.push({ key: c.key, n: total });
    }
    if (counts.length) {
      counts.sort((a, b) => b.n - a.n);
      return counts[0].key;
    }

    // Pass 2: presence fallback (no numbers in text)
    for (const c of cats) {
      if (c.re.test(t)) return c.key;
    }
    return null;
  }

  private inferDeviceDescription(text: string | null | undefined): string | null {
    if (!text) return null;
    const t = text.toLowerCase();
    // Check most-specific phrases first so "rooftop mini-grid" wins
    // for mini-grid (the topology) over "rooftop" (the mounting).
    if (/\bmini[\s-]?grid\b/.test(t)) return 'Mini Grid';
    if (/\bsolar home system\b|\bSHS\b/i.test(t)) return 'Solar Home System';
    if (/\bsolar lantern\b/.test(t)) return 'Solar Lantern';
    if (/\bground[\s-]?mount(ed)?\b|\bground[\s-]?based\b/.test(t))
      return 'Ground Mount Solar';
    if (/\brooftop\b|\broof[\s-]?mount(ed)?\b/.test(t)) return 'Rooftop Solar';
    return null;
  }

  private setupSiteNameWatcher(deviceGroup: FormGroup, index: number) {
    deviceGroup
      .get('siteName')
      ?.valueChanges.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((name: string) => {
          const trimmed = (name || '').trim();
          if (!trimmed || trimmed.length < 2) {
            this.siteNameExists[index] = false;
            return [];
          }
          // Edit-mode: don't flag the device's own current name as a
          // collision. The backend exclude-self logic is by-id; doing
          // it here too avoids the brief red flash on dialog open.
          if (this.isEditMode && trimmed === (this.initSiteName ?? '').trim()) {
            this.siteNameExists[index] = false;
            return [];
          }
          return this.deviceService.checkSiteName(trimmed);
        }),
      )
      .subscribe((res) => {
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
    return '(14) Meter/Measurement ID(s)';
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
    // Move focus to the newly-added input after Angular renders it
    setTimeout(() => {
      const lists = document.querySelectorAll('.serial-list');
      const list = lists[deviceIndex];
      const inputs = list?.querySelectorAll<HTMLInputElement>('input');
      if (inputs && inputs.length) inputs[inputs.length - 1].focus();
    }, 0);
  }

  /** Serial-number values the user has explicitly removed. Keyed
   *  by device index → lowercased value set. Used by
   *  applyMeterIdsExtraction so the same spurious OCR result
   *  doesn't reappear after the user deletes it. */
  private dismissedSerialNumbers: { [deviceIndex: number]: Set<string> } = {};

  removeSerialNumber(deviceIndex: number, rowIndex: number): void {
    const list = this.getSerialNumbers(deviceIndex);
    const removed = (list[rowIndex] || '').trim();
    if (removed) {
      if (!this.dismissedSerialNumbers[deviceIndex]) {
        this.dismissedSerialNumbers[deviceIndex] = new Set();
      }
      this.dismissedSerialNumbers[deviceIndex].add(removed.toLowerCase());
    }
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
    // Edit-mode aware: a slot counts as filled if either a new file
    // is staged in `this.files` OR a server-saved doc is already
    // attached (existingDocs).
    const allDocsUploaded = this.deviceForms.controls.every(
      (group, deviceIndex) => {
        return this.requiredFileTypes.every((fileType) => {
          if (
            fileType === DocumentType.FORM_SF_02 &&
            group.get('sf02EvidenceMode')?.value === 'self'
          ) {
            return true;
          }
          const staged =
            (this.files[deviceIndex]?.[fileType]?.length ?? 0) > 0;
          if (staged) return true;
          const existing = this.existingDocs[deviceIndex]?.[fileType];
          return Array.isArray(existing) && existing.length > 0;
        });
      },
    );

    this.allDocumentsUploaded = allDocsUploaded;
    // Partial submit allowed: docs just influence the warning banner, not formValid
    this.formValid = this.myform.valid;
  }

  /** Check if a file with the same name already exists in any slot for this device. */
  private isDuplicate(deviceIndex: number, file: File): boolean {
    return this.duplicateMatch(deviceIndex, file) !== null;
  }
  /** Returns the slot key where this file is already staged or
   *  already saved on the server, or null. Filename match is enough
   *  on the server side (we don't have the size of an existing-doc
   *  without re-fetching). */
  private duplicateMatch(deviceIndex: number, file: File): string | null {
    const deviceFiles = this.files[deviceIndex];
    if (deviceFiles) {
      for (const [slot, list] of Object.entries(deviceFiles)) {
        if (list?.some((f: File) => f.name === file.name && f.size === file.size)) {
          return slot;
        }
      }
    }
    const existing = this.existingDocs[deviceIndex];
    if (existing) {
      for (const [slot, docs] of Object.entries(existing)) {
        if ((docs as any[])?.some((d) => (d.name || '') === file.name)) {
          return `${slot} (already saved)`;
        }
      }
    }
    return null;
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

    const multiTypes: string[] = [
      'PROJECT_PHOTOS',
      'METERING_EVIDENCE',
      'OTHER_DOCUMENTS',
    ];
    const skippedNames: string[] = [];
    const newFiles: File[] = [];
    for (const f of Array.from(files)) {
      const where = this.duplicateMatch(deviceIndex, f);
      if (where) skippedNames.push(`${f.name} (already in ${where})`);
      else newFiles.push(f);
    }
    if (skippedNames.length) {
      this.toastrService.info(
        `Skipped: ${skippedNames.join('; ')}`,
        'Files can only live in one slot',
      );
    }
    if (newFiles.length === 0) return;

    const prevLen = (this.files[deviceIndex][fileType] || []).length;
    if (multiTypes.includes(fileType)) {
      this.files[deviceIndex][fileType] = [
        ...(this.files[deviceIndex][fileType] || []),
        ...newFiles,
      ];
    } else {
      this.files[deviceIndex][fileType] = newFiles;
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
      fileControl.setValue(
        this.files[deviceIndex][fileType][0] ?? input.files[0],
      );
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

    // Trigger background AI classification
    this.classifyUploadedFile(input.files[0], deviceIndex, fileType);

    // For SLDs, also trigger field extraction (vision via Haiku)
    if (fileType === DocumentType.SINGLE_LINE_DIAGRAM) {
      this.extractSldFieldsForDevice(input.files[0], deviceIndex);
    }
    // For SF-02c letters, extract owner / address / signing date
    if (fileType === DocumentType.SF_02C) {
      this.extractSf02cFieldsForDevice(input.files[0], deviceIndex);
    }
    if (fileType === DocumentType.COD_PROOF) {
      this.extractCodFieldsForDevice(input.files[0], deviceIndex);
    }
    if (fileType === DocumentType.FORM_SF_02) {
      this.extractSf02FieldsForDevice(input.files[0], deviceIndex);
    }
    if (fileType === DocumentType.METERING_EVIDENCE) {
      // Each metering screenshot is a separate inverter most of the
      // time — extract from every newly-added file.
      for (const f of newFiles) {
        this.extractMeterIdsForDevice(f, deviceIndex);
      }
    }
  }

  /** Magic auto-sort: classify multiple files and dispatch them to slots. */
  onMagicUpload(event: Event, deviceIndex: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const filesToProcess = Array.from(input.files);
    input.value = ''; // reset so same files can be re-selected

    this.magicRunning[deviceIndex] = true;
    this.magicDone[deviceIndex] = 0;
    this.magicTotal[deviceIndex] = filesToProcess.length;
    this.magicLog[deviceIndex] = [];

    // Backup current state for cancel
    if (this.files[deviceIndex]) {
      const backup: any = {};
      for (const key of Object.keys(this.files[deviceIndex])) {
        backup[key] = [...(this.files[deviceIndex] as any)[key]];
      }
      this.magicBackupFiles[deviceIndex] = backup;
    } else {
      this.magicBackupFiles[deviceIndex] = {} as any;
    }
    this.magicBackupPreviews[deviceIndex] = this.filePreviews[deviceIndex]
      ? { ...this.filePreviews[deviceIndex] }
      : ({} as any);

    if (!this.files[deviceIndex]) {
      this.files[deviceIndex] = this.requiredFileTypes.reduce(
        (acc, docType) => {
          acc[docType] = [];
          return acc;
        },
        {} as DeviceFiles,
      );
    }

    const processNext = (idx: number) => {
      if (idx >= filesToProcess.length) {
        this.ngZone.run(() => {
          this.magicRunning[deviceIndex] = false;
          this.magicCurrentFile[deviceIndex] = null;
          this.magicCurrentStep[deviceIndex] = null;
          this.checkDocumentsUploaded();
        });
        return;
      }

      const file = filesToProcess[idx];
      this.ngZone.run(() => {
        this.magicCurrentFile[deviceIndex] = file.name;
        this.magicCurrentStep[deviceIndex] = null;
      });
      if (this.isDuplicate(deviceIndex, file)) {
        // Don't route the duplicate to a slot, but DO classify it so
        // the OK + Extract path can still pull fields from the bytes.
        this.documentClassifier.classify(file, (step) =>
          this.ngZone.run(() => {
            this.magicCurrentStep[deviceIndex] = step;
          }),
        ).subscribe({
          next: (result) => {
            this.ngZone.run(() => {
              const rawType = result?.suggestedType ?? DocumentType.OTHER_DOCUMENTS;
              this.magicLog[deviceIndex].push({
                filename: file.name.length > 40 ? file.name.substring(0, 37) + '...' : file.name,
                target: 'Skipped (duplicate)',
                confidence: null,
                type: 'miss',
                file,
                docType: rawType,
              });
              this.magicDone[deviceIndex] = idx + 1;
            });
            setTimeout(() => processNext(idx + 1));
          },
          error: () => {
            this.ngZone.run(() => {
              this.magicLog[deviceIndex].push({
                filename: file.name.length > 40 ? file.name.substring(0, 37) + '...' : file.name,
                target: 'Skipped (duplicate)',
                confidence: null,
                type: 'miss',
                file,
              });
              this.magicDone[deviceIndex] = idx + 1;
            });
            setTimeout(() => processNext(idx + 1));
          },
        });
        return;
      }
      this.documentClassifier.classify(file, (step) =>
        this.ngZone.run(() => {
          this.magicCurrentStep[deviceIndex] = step;
        }),
      ).subscribe({
        next: (result) => {
          this.ngZone.run(() => {
            const rawType = result?.suggestedType ?? DocumentType.OTHER_DOCUMENTS;
            // FACILITY_BOUNDARY has no registrant-side upload slot today,
            // so drop the boundary file into PROJECT_PHOTOS where it can
            // still be reviewed. Magic-table label below still shows
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

            // Place file in the target slot
            const multiTypes = [
              'PROJECT_PHOTOS',
              'METERING_EVIDENCE',
              'OTHER_DOCUMENTS',
            ];
            if (multiTypes.includes(targetType)) {
              this.files[deviceIndex][targetType as FileType] = [
                ...(this.files[deviceIndex][targetType as FileType] || []),
                file,
              ];
            } else {
              this.files[deviceIndex][targetType as FileType] = [file];
            }

            // Keep fileLabels aligned
            if (!this.fileLabels[deviceIndex])
              this.fileLabels[deviceIndex] = {};
            const len =
              this.files[deviceIndex][targetType as FileType].length;
            this.fileLabels[deviceIndex][targetType] = Array(len).fill('');

            // Set form control
            const control = this.deviceForms
              .at(deviceIndex)
              .get(targetType);
            if (control) {
              control.setValue(
                this.files[deviceIndex][targetType as FileType][0] ?? null,
              );
              control.markAsDirty();
            }

            // Generate preview
            if (!this.filePreviews[deviceIndex])
              this.filePreviews[deviceIndex] = {};
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';
            const isExcel = /\.(xlsx|xls)$/i.test(file.name);
            const objectUrl = URL.createObjectURL(file);
            this.filePreviews[deviceIndex][targetType] = {
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

            // Log entry
            this.magicLog[deviceIndex].push({
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

            this.magicDone[deviceIndex] = idx + 1;
            processNext(idx + 1);
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.magicLog[deviceIndex].push({
              filename: file.name.length > 40
                ? file.name.substring(0, 37) + '...'
                : file.name,
              target: 'Other Document',
              confidence: null,
              type: 'miss',
              file,
            });

            // Put in OTHER_DOCUMENTS on error
            this.files[deviceIndex][DocumentType.OTHER_DOCUMENTS] = [
              ...(this.files[deviceIndex][DocumentType.OTHER_DOCUMENTS] ||
                []),
              file,
            ];

            this.magicDone[deviceIndex] = idx + 1;
            processNext(idx + 1);
          });
        },
      });
    };

    processNext(0);
  }

  /** Run AI classification on an uploaded file and store the suggestion. */
  private extractSldFieldsForDevice(file: File, deviceIndex: number): void {
    this.sldExtracting[deviceIndex] = true;
    this.sldExtractions[deviceIndex] = null;
    this.documentClassifier
      .extractSldFields(file)
      .then((res) =>
        this.ngZone.run(() => {
          this.sldExtracting[deviceIndex] = false;
          this.sldExtractions[deviceIndex] = res;
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.sldExtracting[deviceIndex] = false;
        }),
      );
  }

  /** Apply confident SLD-extracted values into the form. We only patch
   *  fields the user hasn't already filled in (don't overwrite manual
   *  input) and only when confidence ≥ 0.7. Reasoning: any false
   *  positive at this layer is a bug a registrant has to find and undo. */
  applySldExtraction(deviceIndex: number): void {
    const fx = this.sldExtractions[deviceIndex];
    if (!fx) return;
    const form = this.deviceForms.at(deviceIndex);
    const patchIfEmpty = (
      controlName: string,
      field: { value: any; confidence: number } | undefined,
      transform?: (v: any) => any,
    ) => {
      if (!field || field.confidence < 0.7) return;
      const ctl = form.get(controlName);
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
    patchIfEmpty('networkOwner', fx.networkOwner);
    patchIfEmpty('hasNetworkMeter', fx.hasNetworkMeter, (v) => (v ? 'Yes' : 'No'));
    patchIfEmpty('gridExportType', fx.gridExportType);
    patchIfEmpty('hasAuxiliaryEnergySources', fx.hasAuxiliaryEnergySources, (v) => (v ? 'Yes' : 'No'));
    patchIfEmpty('auxiliaryEnergySourceDetails', fx.auxiliaryEnergySourceDetails);
    // SLD always describes inverter-side topology — if we read an
    // inverter make/model or count, the data source is the inverter.
    if (fx.inverterMakeModel || fx.inverterCount) {
      this.setDataSourceIfEmpty(deviceIndex, 'Inverter');
    }
    this.toastrService.success('SLD fields applied to the form');
  }

  /** Set `dataSource` to a specific enum value only if the form
   *  control is currently empty. Used by SLD / SF-02 / meter-ids
   *  applies when an inverter signal is present. */
  private setDataSourceIfEmpty(deviceIndex: number, value: string): void {
    const ctl = this.deviceForms.at(deviceIndex).get('dataSource');
    if (!ctl) return;
    if (ctl.value !== null && ctl.value !== undefined && ctl.value !== '') return;
    ctl.setValue(value);
    ctl.markAsDirty();
  }

  dismissSldExtraction(deviceIndex: number): void {
    this.sldExtractions[deviceIndex] = null;
  }

  private extractSf02cFieldsForDevice(file: File, deviceIndex: number): void {
    this.sf02cExtracting[deviceIndex] = true;
    this.sf02cExtractions[deviceIndex] = null;
    this.documentClassifier
      .extractSf02cFields(file)
      .then((res) =>
        this.ngZone.run(() => {
          this.sf02cExtracting[deviceIndex] = false;
          this.sf02cExtractions[deviceIndex] = res;
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.sf02cExtracting[deviceIndex] = false;
        }),
      );
  }

  applySf02cExtraction(deviceIndex: number): void {
    const fx = this.sf02cExtractions[deviceIndex];
    if (!fx) return;
    const form = this.deviceForms.at(deviceIndex);
    const patchIfEmpty = (
      controlName: string,
      field: { value: any; confidence: number } | undefined,
      transform?: (v: any) => any,
    ) => {
      if (!field || field.confidence < 0.7) return;
      const ctl = form.get(controlName);
      if (!ctl) return;
      const current = ctl.value;
      if (current !== null && current !== undefined && current !== '') return;
      const v = transform ? transform(field.value) : field.value;
      ctl.setValue(v);
      ctl.markAsDirty();
    };
    patchIfEmpty('siteName', fx.projectName);
    patchIfEmpty('pvSystemOwner', fx.ownerLegalName);
    patchIfEmpty('address', fx.ownerAddress);
    patchIfEmpty('countryCodename', fx.ownerCountry);
    patchIfEmpty('signatoryName', fx.signatoryName);
    this.toastrService.success('SF-02c fields applied to the form');
  }

  dismissSf02cExtraction(deviceIndex: number): void {
    this.sf02cExtractions[deviceIndex] = null;
  }

  private extractCodFieldsForDevice(file: File, deviceIndex: number): void {
    this.codExtracting[deviceIndex] = true;
    this.codExtractions[deviceIndex] = null;
    this.documentClassifier
      .extractCodFields(file)
      .then((res) =>
        this.ngZone.run(() => {
          this.codExtracting[deviceIndex] = false;
          this.codExtractions[deviceIndex] = res;
          // Opportunistic SN harvest: COD proofs sometimes carry an
          // equipment list. Merge any IDs into the meter-ids banner
          // so the user can apply them in one place.
          if (
            res?.measurementIds &&
            res.measurementIds.confidence >= 0.7 &&
            res.measurementIds.value.length
          ) {
            const existing = new Set(
              this.meterIdsExtractions[deviceIndex] || [],
            );
            for (const id of res.measurementIds.value) existing.add(id);
            this.meterIdsExtractions[deviceIndex] = [...existing];
          }
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.codExtracting[deviceIndex] = false;
        }),
      );
  }

  applyCodExtraction(deviceIndex: number): void {
    const fx = this.codExtractions[deviceIndex];
    if (!fx) return;
    const form = this.deviceForms.at(deviceIndex);
    const patchIfEmpty = (
      controlName: string,
      field: { value: any; confidence: number } | undefined,
    ) => {
      if (!field || field.confidence < 0.7) return;
      const ctl = form.get(controlName);
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
    // utilityOrIssuer is the COD signatory, NOT necessarily the DSO
    // (EPC-led projects sign their own CODs — e.g. CrossBoundary
    // Access). Don't auto-fill networkOwner from it; it still shows
    // up as a candidate in the cross-doc conflict panel for the
    // user to accept manually if appropriate.
    this.toastrService.success('COD proof fields applied to the form');
  }

  dismissCodExtraction(deviceIndex: number): void {
    this.codExtractions[deviceIndex] = null;
  }

  private extractSf02FieldsForDevice(file: File, deviceIndex: number): void {
    this.sf02Extracting[deviceIndex] = true;
    this.sf02Extractions[deviceIndex] = null;
    this.documentClassifier
      .extractSf02Fields(file)
      .then((res) =>
        this.ngZone.run(() => {
          this.sf02Extracting[deviceIndex] = false;
          this.sf02Extractions[deviceIndex] = res;
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.sf02Extracting[deviceIndex] = false;
        }),
      );
  }

  applySf02Extraction(deviceIndex: number): void {
    const fx = this.sf02Extractions[deviceIndex];
    if (!fx) return;
    const form = this.deviceForms.at(deviceIndex);
    const patchIfEmpty = (
      controlName: string,
      field: { value: any; confidence: number } | undefined,
    ) => {
      if (!field || field.confidence < 0.7) return;
      const ctl = form.get(controlName);
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
    patchIfEmpty('networkOwner', fx.networkOwner);
    if (fx.inverterCount) {
      this.setDataSourceIfEmpty(deviceIndex, 'Inverter');
    }
    this.toastrService.success('SF-02 fields applied to the form');
  }

  dismissSf02Extraction(deviceIndex: number): void {
    this.sf02Extractions[deviceIndex] = null;
  }

  private extractMeterIdsForDevice(file: File, deviceIndex: number): void {
    this.meterIdsExtracting[deviceIndex] = true;
    if (!this.meterIdsExtractions[deviceIndex]) {
      this.meterIdsExtractions[deviceIndex] = [];
    }
    this.documentClassifier
      .extractMeterIds(file)
      .then((res) =>
        this.ngZone.run(() => {
          this.meterIdsExtracting[deviceIndex] = false;
          if (res?.measurementIds && res.measurementIds.confidence >= 0.7) {
            const existing = new Set(
              this.meterIdsExtractions[deviceIndex] || [],
            );
            for (const id of res.measurementIds.value) existing.add(id);
            this.meterIdsExtractions[deviceIndex] = [...existing];
          }
          if (res?.inverterMakeModel && res.inverterMakeModel.confidence >= 0.7) {
            this.meterIdsBrands[deviceIndex] = res.inverterMakeModel.value;
          }
        }),
      )
      .catch(() =>
        this.ngZone.run(() => {
          this.meterIdsExtracting[deviceIndex] = false;
        }),
      );
  }

  applyMeterIdsExtraction(deviceIndex: number): void {
    const ids = this.meterIdsExtractions[deviceIndex] || [];
    if (!ids.length) return;
    // The (14) input list is rendered from serialNumberLists[i], not
    // straight from the form control — so we have to update both.
    const existing = (this.getSerialNumbers(deviceIndex) || [])
      .map((s) => (s || '').trim())
      .filter(Boolean);
    const dismissed = this.dismissedSerialNumbers[deviceIndex] ?? new Set();
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const id of [...existing, ...ids]) {
      const k = id.toLowerCase();
      if (seen.has(k)) continue;
      // Skip OCR/Haiku suggestions the user has already removed
      // from the list — they shouldn't reappear after deletion.
      if (dismissed.has(k) && !existing.includes(id)) continue;
      seen.add(k);
      merged.push(id);
    }
    if (merged.length === existing.length) {
      this.toastrService.info('No new measurement IDs to add');
      return;
    }
    this.serialNumberLists[deviceIndex] = merged.length ? merged : [''];
    this.syncSerialNumberControl(deviceIndex);
    // SNs were read from a metering portal / nameplate — the data
    // source is the inverter.
    this.setDataSourceIfEmpty(deviceIndex, 'Inverter');
    // Patch (27) Data Source Brand Name when we also captured an
    // inverter make/model from any of the screenshots.
    const brand = this.meterIdsBrands[deviceIndex];
    if (brand) {
      const brandCtl = this.deviceForms.at(deviceIndex).get('dataSourceBrand');
      if (brandCtl) {
        const cur = String(brandCtl.value ?? '').trim();
        if (!cur) {
          brandCtl.setValue(brand);
          brandCtl.markAsDirty();
        }
      }
    }
    const added = merged.length - existing.length;
    this.toastrService.success(
      `${added} measurement ID${added === 1 ? '' : 's'} added`,
    );
  }

  dismissMeterIdsExtraction(deviceIndex: number): void {
    this.meterIdsExtractions[deviceIndex] = [];
  }

  /** OK + Extract: keep the magic dialog open, transition into
   *  extraction-phase view, kick off all matching extractors.
   *  Files are already routed (the classifier moved them at sort
   *  time); we just clean up the cancel-backup since the user is
   *  committing. */
  extractAllFromMagic(deviceIndex: number): void {
    const log = this.magicLog[deviceIndex] || [];
    // Drop the cancel-rollback backup -- user committed to the sort.
    delete this.magicBackupFiles[deviceIndex];
    delete this.magicBackupPreviews[deviceIndex];
    this.magicExtractMode[deviceIndex] = true;
    for (const entry of log) {
      if (!entry.file || !entry.docType) continue;
      switch (entry.docType) {
        case DocumentType.SINGLE_LINE_DIAGRAM:
          this.extractSldFieldsForDevice(entry.file, deviceIndex);
          break;
        case DocumentType.SF_02C:
          this.extractSf02cFieldsForDevice(entry.file, deviceIndex);
          break;
        case DocumentType.COD_PROOF:
          this.extractCodFieldsForDevice(entry.file, deviceIndex);
          break;
        case DocumentType.FORM_SF_02:
          this.extractSf02FieldsForDevice(entry.file, deviceIndex);
          break;
        case DocumentType.METERING_EVIDENCE:
          this.extractMeterIdsForDevice(entry.file, deviceIndex);
          break;
      }
    }
  }

  /** True while any extractor is still running on this device. */
  isAnyExtracting(deviceIndex: number): boolean {
    return !!(
      this.sldExtracting[deviceIndex] ||
      this.sf02cExtracting[deviceIndex] ||
      this.codExtracting[deviceIndex] ||
      this.sf02Extracting[deviceIndex] ||
      this.meterIdsExtracting[deviceIndex]
    );
  }

  /** True if at least one extractor returned a usable result. */
  hasAnyExtractionResult(deviceIndex: number): boolean {
    return !!(
      this.sldExtractions[deviceIndex] ||
      this.sf02cExtractions[deviceIndex] ||
      this.codExtractions[deviceIndex] ||
      this.sf02Extractions[deviceIndex] ||
      (this.meterIdsExtractions[deviceIndex]?.length ?? 0) > 0
    );
  }

  /** Aggregate every extractor's per-form-field claim with its
   *  source label and confidence. One field may have multiple claims
   *  (e.g. capacity from SLD + COD + SF-02). */
  collectExtractionClaims(
    deviceIndex: number,
  ): {
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
    const sld = this.sldExtractions[deviceIndex];
    if (sld) {
      add('capacity', 'SLD', sld.acCapacityKw);
      add('generatingUnitCount', 'SLD', sld.inverterCount);
      add('interconnectionVoltage', 'SLD', sld.gridVoltage);
      add('gridInterconnection', 'SLD', sld.gridTied, (v) =>
        v ? 'true' : 'false',
      );
      add('dataSourceBrand', 'SLD', sld.inverterMakeModel);
      add('networkOwner', 'SLD', sld.networkOwner);
      add('hasNetworkMeter', 'SLD', sld.hasNetworkMeter, (v) =>
        v ? 'Yes' : 'No',
      );
      add('gridExportType', 'SLD', sld.gridExportType);
      add('hasAuxiliaryEnergySources', 'SLD', sld.hasAuxiliaryEnergySources, (v) =>
        v ? 'Yes' : 'No',
      );
      add('auxiliaryEnergySourceDetails', 'SLD', sld.auxiliaryEnergySourceDetails);
    }
    const sf02c = this.sf02cExtractions[deviceIndex];
    if (sf02c) {
      add('siteName', 'SF-02c', sf02c.projectName);
      add('pvSystemOwner', 'SF-02c', sf02c.ownerLegalName);
      add('address', 'SF-02c', sf02c.ownerAddress);
      add('countryCodename', 'SF-02c', sf02c.ownerCountry);
    }
    const cod = this.codExtractions[deviceIndex];
    if (cod) {
      add('commissioningDate', 'COD', cod.commissioningDate);
      add('siteName', 'COD', cod.facilityName);
      add('capacity', 'COD', cod.acCapacityKw);
      add('pvSystemOwner', 'COD', cod.ownerName);
      // utilityOrIssuer dropped from networkOwner candidates — it's
      // the COD signatory (often the EPC), not the DSO. The
      // dedicated networkOwner field on SF-02 is the reliable source.
    }
    const sf02 = this.sf02Extractions[deviceIndex];
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
      add('networkOwner', 'SF-02', sf02.networkOwner);
    }
    return claims;
  }

  /** Returns only the entries where ≥2 sources disagree (after
   *  normalisation: numbers rounded to 2dp, strings trimmed +
   *  lowercased). */
  getConflicts(
    deviceIndex: number,
  ): {
    [field: string]: Array<{ source: string; value: any; confidence: number }>;
  } {
    const claims = this.collectExtractionClaims(deviceIndex);
    const out: typeof claims = {};
    for (const [field, list] of Object.entries(claims)) {
      if (list.length < 2) continue;
      const norm = (v: any) => {
        if (typeof v === 'number') return Number(v.toFixed(2));
        if (typeof v === 'string') return v.trim().toLowerCase();
        if (typeof v === 'boolean') return String(v);
        return v;
      };
      const distinct = new Set(list.map((c) => JSON.stringify(norm(c.value))));
      if (distinct.size > 1) out[field] = list;
    }
    return out;
  }

  hasConflicts(deviceIndex: number): boolean {
    return Object.keys(this.getConflicts(deviceIndex)).length > 0;
  }

  setConflictPick(
    deviceIndex: number,
    field: string,
    source: string,
  ): void {
    if (!this.conflictPicks[deviceIndex]) this.conflictPicks[deviceIndex] = {};
    this.conflictPicks[deviceIndex][field] = source;
  }

  isConflictPickSelected(
    deviceIndex: number,
    field: string,
    source: string,
    list: Array<{ source: string; confidence: number }>,
  ): boolean {
    const picked = this.conflictPicks[deviceIndex]?.[field];
    if (picked) return picked === source;
    // No explicit pick yet — default to highest-confidence claim.
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

  /** Apply every extractor's claim to the form. For fields with
   *  multiple claims, use the user's pick (or highest-confidence
   *  fallback). Patch-empty-only — never overwrites manual input. */
  applyAllExtracted(deviceIndex: number): void {
    const claims = this.collectExtractionClaims(deviceIndex);
    const picks = this.conflictPicks[deviceIndex] || {};
    const form = this.deviceForms.at(deviceIndex);
    for (const [field, list] of Object.entries(claims)) {
      const ctl = form.get(field);
      if (!ctl) continue;
      const current = String(ctl.value ?? '').trim();
      if (current) continue;
      let chosen = list[0];
      if (list.length > 1) {
        const pickedSource = picks[field];
        chosen =
          (pickedSource && list.find((c) => c.source === pickedSource)) ||
          [...list].sort((a, b) => b.confidence - a.confidence)[0];
      }
      ctl.setValue(chosen.value);
      ctl.markAsDirty();
    }
    // Inverter signal → dataSource = Inverter
    if (
      claims['generatingUnitCount']?.length ||
      claims['dataSourceBrand']?.length
    ) {
      this.setDataSourceIfEmpty(deviceIndex, 'Inverter');
    }
    // Meter IDs (list union) and meter-ids-extracted brand still
    // route through the existing single-source apply path.
    if (this.meterIdsExtractions[deviceIndex]?.length) {
      this.applyMeterIdsExtraction(deviceIndex);
    }
    this.toastrService.success('Extracted fields applied to the form');
    this.dismissMagicExtraction(deviceIndex);
  }

  dismissMagicExtraction(deviceIndex: number): void {
    this.magicLog[deviceIndex] = [];
    this.magicExtractMode[deviceIndex] = false;
    this.sldExtractions[deviceIndex] = null;
    this.sf02cExtractions[deviceIndex] = null;
    this.codExtractions[deviceIndex] = null;
    this.sf02Extractions[deviceIndex] = null;
    this.meterIdsExtractions[deviceIndex] = [];
    delete this.meterIdsBrands[deviceIndex];
    delete this.conflictPicks[deviceIndex];
  }

  private classifyUploadedFile(
    file: File,
    deviceIndex: number,
    currentType: string,
  ): void {
    if (!this.classifying[deviceIndex]) this.classifying[deviceIndex] = {};
    if (!this.classificationSuggestions[deviceIndex])
      this.classificationSuggestions[deviceIndex] = {};

    this.classifying[deviceIndex][currentType] = true;
    this.classificationSuggestions[deviceIndex][currentType] = null;

    this.documentClassifier.classify(file).subscribe({
      next: (result) => {
        this.ngZone.run(() => {
          this.classifying[deviceIndex][currentType] = false;
          if (
            result &&
            result.suggestedType !== currentType &&
            result.confidence >= 0.4
          ) {
            this.classificationSuggestions[deviceIndex][currentType] = result;
          }
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.classifying[deviceIndex][currentType] = false;
        });
      },
    });
  }

  /** Accept an AI classification suggestion: move the file to the suggested slot. */
  acceptClassification(deviceIndex: number, fromType: string): void {
    const suggestion =
      this.classificationSuggestions[deviceIndex]?.[fromType];
    if (!suggestion) return;

    const toType = suggestion.suggestedType as string as FileType;
    const filesInSlot = this.files[deviceIndex]?.[fromType as FileType];
    if (!filesInSlot?.length) return;

    // Move file(s) to the suggested slot
    if (!this.files[deviceIndex][toType]) {
      this.files[deviceIndex][toType] = [];
    }
    this.files[deviceIndex][toType] = [
      ...this.files[deviceIndex][toType],
      ...filesInSlot,
    ];
    this.files[deviceIndex][fromType as FileType] = [];

    // Move preview
    if (this.filePreviews[deviceIndex]?.[fromType]) {
      this.filePreviews[deviceIndex][toType] = this.filePreviews[deviceIndex][fromType];
      delete this.filePreviews[deviceIndex][fromType];
    }

    // Update form controls
    const fromControl = this.deviceForms.at(deviceIndex).get(fromType);
    const toControl = this.deviceForms.at(deviceIndex).get(toType);
    if (fromControl) fromControl.setValue(null);
    if (toControl) {
      toControl.setValue(this.files[deviceIndex][toType][0] ?? null);
      toControl.markAsDirty();
    }

    // Clear suggestion
    this.classificationSuggestions[deviceIndex][fromType] = null;
    this.checkDocumentsUploaded();
  }

  /** Dismiss an AI classification suggestion. */
  dismissClassification(deviceIndex: number, fileType: string): void {
    if (this.classificationSuggestions[deviceIndex]) {
      this.classificationSuggestions[deviceIndex][fileType] = null;
    }
  }

  /** Read-only view of staged files for a slot — typed in TS so the
   *  template doesn't have to fight `keyof DeviceFiles`. */
  getStagedFiles(deviceIndex: number, fileType: string): File[] {
    return (this.files[deviceIndex]?.[fileType as keyof DeviceFiles] as File[] | undefined) ?? [];
  }

  /** Run client-side Tesseract OCR on a metering-evidence image and
   *  show the extracted text in a dialog. Useful when the
   *  registrant wants to copy a meter reading / SN out of a
   *  monitoring-portal screenshot manually. */
  ocrResultText: string | null = null;
  ocrResultRunning = false;
  @ViewChild('ocrResultDialog') ocrResultDialogTemplate?: TemplateRef<any>;
  private ocrResultDialogRef: MatDialogRef<any> | null = null;

  async runOcrOnStagedFile(file: File): Promise<void> {
    if (this.ocrResultRunning) return;
    this.ocrResultRunning = true;
    this.ocrResultText = null;
    if (this.ocrResultDialogTemplate) {
      this.ocrResultDialogRef = this.dialog.open(this.ocrResultDialogTemplate, {
        // Don't set width/height here — let the .ocr-result-window
        // CSS define the initial size (720×420). The user resizes
        // via the bottom-right corner; mat-dialog caps are lifted
        // in styles.scss so they don't fight the resize.
        hasBackdrop: false,
        panelClass: 'ocr-result-dialog',
      });
    }
    try {
      const isPdf =
        file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      let text = '';
      if (isPdf) {
        // 1. Try the embedded text layer (instant, lossless on
        //    digitally-generated PDFs like e-signed contracts).
        const layer = await (this.documentClassifier as any)
          .extractPdfTextLayer(file)
          .catch(() => '');
        if ((layer || '').trim().length > 40) {
          text = layer;
        } else {
          // 2. Scanned PDF — render each page and OCR with Tesseract.
          text = await this.ocrPdfWithTesseract(file);
        }
      } else {
        text = await this.ocrImageWithTesseract(file);
      }
      this.ocrResultText =
        (text || '').trim() || '(no text recognised)';
    } catch (err: any) {
      this.ocrResultText = `OCR failed: ${err?.message ?? err}`;
    } finally {
      this.ocrResultRunning = false;
    }
  }

  private async ocrImageWithTesseract(file: File): Promise<string> {
    const Tesseract = await import('tesseract.js' as any);
    const createWorker =
      Tesseract.createWorker || Tesseract.default?.createWorker;
    const worker = await createWorker('eng+fra', 1);
    try {
      const canvas = await this.imageFileToCanvas(file);
      const { data } = await worker.recognize(canvas);
      return data.text;
    } finally {
      await worker.terminate();
    }
  }

  private async ocrPdfWithTesseract(file: File): Promise<string> {
    let pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) {
      pdfjs = await import('pdfjs-dist' as any);
    }
    pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
    }).promise;
    const Tesseract = await import('tesseract.js' as any);
    const createWorker =
      Tesseract.createWorker || Tesseract.default?.createWorker;
    const worker = await createWorker('eng+fra', 1);
    try {
      const chunks: string[] = [];
      const pages = Math.min(pdf.numPages, 10); // cap for sanity
      for (let p = 1; p <= pages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const { data } = await worker.recognize(canvas);
        chunks.push(`--- Page ${p} ---\n${data.text}`);
      }
      return chunks.join('\n\n');
    } finally {
      await worker.terminate();
    }
  }

  private async imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  closeOcrResult(): void {
    this.ocrResultDialogRef?.close();
    this.ocrResultDialogRef = null;
  }

  copyOcrResult(): void {
    if (!this.ocrResultText) return;
    navigator.clipboard?.writeText(this.ocrResultText).then(
      () => this.toastrService.success('OCR text copied'),
      () => this.toastrService.error('Failed to copy'),
    );
  }

  /** Remove a staged (not-yet-saved) file from a slot. Mirrors the
   *  existing-doc delete affordance for files already on the server. */
  removeStagedFile(deviceIndex: number, fileType: string, fileIndex: number): void {
    const list = this.files[deviceIndex]?.[fileType as keyof DeviceFiles] as File[] | undefined;
    if (!list) return;
    const removed = list.splice(fileIndex, 1)[0];
    if (this.fileLabels[deviceIndex]?.[fileType]) {
      this.fileLabels[deviceIndex][fileType].splice(fileIndex, 1);
    }
    // Form control + preview track only the first file in multi-slots,
    // so refresh both based on what's left.
    const ctrl = this.deviceForms.at(deviceIndex).get(fileType);
    if (ctrl) {
      ctrl.setValue(list[0] ?? null);
      ctrl.markAsDirty();
    }
    if (this.filePreviews[deviceIndex]) {
      const preview = this.filePreviews[deviceIndex][fileType];
      if (list.length === 0) {
        if (preview?.url) {
          URL.revokeObjectURL(preview.url as unknown as string);
        }
        delete this.filePreviews[deviceIndex][fileType];
      } else {
        const next = list[0];
        const isImage = next.type.startsWith('image/');
        const isPdf = next.type === 'application/pdf';
        const isExcel = /\.(xlsx|xls)$/i.test(next.name);
        if (preview?.url) {
          URL.revokeObjectURL(preview.url as unknown as string);
        }
        const objectUrl = URL.createObjectURL(next);
        this.filePreviews[deviceIndex][fileType] = {
          url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
          type: isImage ? 'image' : isPdf ? 'pdf' : isExcel ? 'excel' : 'other',
          name: next.name,
        };
      }
    }
    void removed;
    this.checkDocumentsUploaded?.();
  }

  openPreview(deviceIndex: number, fileType: string) {
    const preview = this.filePreviews[deviceIndex]?.[fileType];
    if (!preview) return;
    this.previewData = preview;
    this.currentPreviewFile =
      this.files[deviceIndex]?.[fileType as keyof DeviceFiles]?.[0] ?? null;
    this.currentPreviewDocType = fileType;
    this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
      width: '95vw',
      maxWidth: '100vw',
      height: '90vh',
      maxHeight: '100vh',
      panelClass: 'file-preview-dialog',
    });
  }

  viewMagicFile(file: File, deviceIndex: number): void {
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
      maxWidth: '100vw',
      height: '90vh',
      maxHeight: '100vh',
      panelClass: 'file-preview-dialog',
    });
  }

  acceptMagic(deviceIndex: number): void {
    this.magicLog[deviceIndex] = [];
    delete this.magicBackupFiles[deviceIndex];
    delete this.magicBackupPreviews[deviceIndex];
  }

  cancelMagic(deviceIndex: number): void {
    if (this.magicBackupFiles[deviceIndex]) {
      this.files[deviceIndex] = this.magicBackupFiles[deviceIndex] as any;
    }
    if (this.magicBackupPreviews[deviceIndex]) {
      this.filePreviews[deviceIndex] = this.magicBackupPreviews[deviceIndex] as any;
    }
    this.magicLog[deviceIndex] = [];
    delete this.magicBackupFiles[deviceIndex];
    delete this.magicBackupPreviews[deviceIndex];
  }

  renameableTypes: string[] = ['PROJECT_PHOTOS', 'METERING_EVIDENCE'];

  renameDialogFiles: {
    file: File;
    url: string;
    name: string;
    type: 'image' | 'pdf' | 'excel' | 'other';
    label: string;
  }[] = [];

  openRenameDialog(deviceIndex: number, fileType: string): void {
    const files =
      this.files[deviceIndex]?.[fileType as keyof DeviceFiles] || [];
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
      const type: 'image' | 'pdf' | 'excel' | 'other' = [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'webp',
        'bmp',
        'svg',
      ].includes(ext)
        ? 'image'
        : ext === 'pdf'
          ? 'pdf'
          : ext === 'xlsx' || ext === 'xls'
            ? 'excel'
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
    this.fileLabels[this.renameDialogDeviceIndex][this.renameDialogType] =
      labels;
    this.renameDialogRef?.close();
  }

  cancelRenameDialog(): void {
    this.renameDialogRef?.close();
  }

  fileExtension(name: string): string {
    return (name.split('.').pop() || '').toUpperCase();
  }

  openRenamePreview(r: {
    url: string;
    name: string;
    type: 'image' | 'pdf' | 'excel' | 'other';
    file: File;
  }): void {
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
      maxWidth: '100vw',
      height: '90vh',
      maxHeight: '100vh',
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
          const files =
            this.files[deviceIndex]?.[type as keyof DeviceFiles] || [];
          const labels = labelsByType[type] || [];
          for (let i = 0; i < files.length; i++) {
            const label = (labels[i] || '').trim();
            if (!label) continue;
            const match = docs.find(
              (d) =>
                d.type === type &&
                d.originalFilename === files[i].name &&
                !d.label,
            );
            if (!match) continue;
            this.deviceService.updateDocumentLabel(match.id, label).subscribe({
              error: (err) =>
                console.warn(
                  `Failed to save label for ${files[i].name}`,
                  err?.message,
                ),
            });
          }
        }
      },
      error: (err) =>
        console.warn('Failed to fetch documents for labeling', err?.message),
    });
  }

  /**
   * Save & Generate SF-02 for a single row. Equivalent to bulk Submit
   * for that one device, then immediately calls
   * /device-reviews/:id/generate-sf02. The row stays in the FormArray
   * (so the user can see the timestamp + Re-generate) but bulk Submit
   * will skip it on subsequent runs.
   */
  saveAndGenerateSf02(index: number): void {
    // Edit mode: device already exists, just regenerate.
    if (this.isEditMode && this.editingDeviceId != null) {
      this.runGenerateSf02(index, this.editingDeviceId);
      return;
    }
    if (this.savedDeviceIdByIndex[index] != null) {
      // Already saved in this session; just regenerate.
      this.runGenerateSf02(index, this.savedDeviceIdByIndex[index]);
      return;
    }
    if (this.isGeneratingSf02ByIndex[index]) return;
    this.myform.markAllAsTouched();
    if (!this.myform.valid) {
      this.toastrService.error(
        'Fix validation errors before saving this device.',
        'SF-02',
      );
      return;
    }
    const element = this.myform.value.devices[index];
    if (!element) return;
    const formData = this.buildDeviceFormData(element, index);
    if (!formData) return;

    this.isGeneratingSf02ByIndex[index] = true;
    this.deviceService.create(formData).subscribe({
      next: (result: any) => {
        if (!result?.id) {
          this.isGeneratingSf02ByIndex[index] = false;
          this.toastrService.error(
            'Saved but no device id returned',
            'SF-02',
          );
          return;
        }
        this.savedDeviceIdByIndex[index] = result.id;
        this.persistStagedLabels(result.id, index);
        this.runGenerateSf02(index, result.id);
      },
      error: (err) => {
        this.isGeneratingSf02ByIndex[index] = false;
        const message =
          err?.error?.message || err?.message || 'Failed to save device';
        this.toastrService.error(message, 'SF-02 — save step failed');
      },
    });
  }

  private runGenerateSf02(index: number, deviceId: number): void {
    this.isGeneratingSf02ByIndex[index] = true;
    this.http
      .post(
        `${environment.API_URL}device-reviews/${deviceId}/generate-sf02`,
        {},
      )
      .subscribe({
        next: () => {
          this.isGeneratingSf02ByIndex[index] = false;
          this.sf02GeneratedAtByIndex[index] = new Date().toISOString();
          this.toastrService.success(
            'Device saved and SF-02 generated',
            'SF-02',
          );
        },
        error: (err) => {
          this.isGeneratingSf02ByIndex[index] = false;
          this.toastrService.error(
            err?.error?.message || err?.message || 'Generation failed',
            'SF-02 — generate step failed',
          );
        },
      });
  }

  onSubmit() {
    if (this.isSubmitting) return;
    this.myform.markAllAsTouched();
    this.checkDocumentsUploaded();
    if (!this.formValid) return;

    // D-REC requires ≥6 decimals on lat/lng (≈10cm) so the coords
    // pinpoint a specific facility, not a 1km cell. Rejected at
    // submission time so the device never enters review with
    // unfixable formal-fail state.
    // Coord-precision check intentionally removed: once the
    // registrant has typed or drag-adjusted lat/lng, the value is
    // theirs to own. Reviewer-side automation flags low-precision
    // sites independently, so blocking submit here was paternalistic.

    this.openPopupDialog();
    this.isSubmitting = true;
  }

  /**
   * Build the FormData payload for a single device row (deviceToRegister
   * + eSignature + files). Shared by bulk submit and per-row
   * Save & Generate SF-02. Returns null if any file validation failed.
   */
  private buildDeviceFormData(element: any, index: number): FormData | null {
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
      DocumentType.PROOF_OF_OWNERSHIP,
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
      return null;
    }
    return formData;
  }

  submitForm() {
    if (this.isEditMode) {
      this.submitEdit();
      return;
    }
    const deviceArray = this.myform.value.devices;
    deviceArray.forEach((element: any, index: number) => {
      // Skip rows already saved via Save & Generate SF-02.
      if (this.savedDeviceIdByIndex[index] != null) return;

      const formData = this.buildDeviceFormData(element, index);
      if (!formData) {
        this.submitButtonText = 'Submit';
        this.isSubmitting = false;
        return;
      }

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

  /**
   * OCR is only meaningful on document images that contain text
   * (meter screens, datasheets, statements, contracts). Site /
   * project photos are visual evidence — running OCR on them
   * yields nothing useful and confuses reviewers, so suppress the
   * OCR affordance for those.
   */
  /**
   * Edit-mode aware "has at least one doc for this slot" check.
   * - Add mode: only the form-control's value matters (newly chosen file).
   * - Edit mode: also count server-saved docs surfaced in existingDocs,
   *   so the (!) "missing" badge doesn't fire when docs are obviously
   *   already attached.
   */
  /**
   * Multi-line tooltip listing every missing/invalid required field
   * with its (NN) form-index prefix. Used by the "Please fill in
   * all required fields" footer notice.
   */
  missingFieldsTooltip(): string {
    const items = this.getMissingFieldsList();
    if (!items.length) return '';
    return 'Missing or invalid:\n' + items.map((s) => `  • ${s}`).join('\n');
  }

  /** Map of formControlName → human "(NN) Field name" label, mirroring
   *  the Add/Edit form labels. Static because labels don't change at
   *  runtime; keep in sync if the form labels are re-numbered. */
  private static readonly FIELD_LABELS: Record<string, string> = {
    siteName: '(2) Site name',
    deviceDescription: '(8) Device description',
    countryCodename: '(9) Country',
    commissioningDate: '(10) Commissioning date',
    deviceTypeCode: '(11) Device type',
    fuelCode: '(12) Fuel code',
    capacity: '(13) AC capacity (kW)',
    pvSystemOwner: '(15) PV system owner',
    address: '(16) Address',
    networkOwner: '(17) Network owner',
    hasNetworkMeter: '(18) Network meter',
    latitude: '(19) Latitude',
    longitude: '(20) Longitude',
    dataSource: '(21) Data source',
    dataSourceBrand: '(22) Data source brand',
    serialNumber: '(23) Serial number / meter ID',
    SDGBenefits: '(28) SDG benefits',
    impactStory: '(29) Impact story',
    operatingConfiguration: '(30) Operating configuration',
    interconnectionVoltage: '(31) Interconnection voltage',
    gridInterconnection: '(32) Grid interconnection',
    generatingUnitCount: '(33) Generating unit count',
    hasAuxiliaryEnergySources: '(34) Auxiliary energy sources?',
    hasPublicFunding: '(35) Has public funding?',
    hasSubsidy: '(36) Has subsidy?',
    labellingSchemeAccreditation: '(37) Labelling-scheme accreditation',
  };

  /** Walk the FormArray and collect labels for every invalid /
   *  required-but-empty control. Falls back to the raw control name
   *  if no label is mapped above. */
  private getMissingFieldsList(): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    this.deviceForms.controls.forEach((group, deviceIndex) => {
      const fg = group as FormGroup;
      Object.keys(fg.controls).forEach((name) => {
        const ctl = fg.get(name);
        if (!ctl || ctl.disabled) return;
        if (ctl.valid) return;
        const label =
          AddDevicesComponent.FIELD_LABELS[name] ??
          name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
        const key =
          this.deviceForms.length > 1
            ? `Row ${deviceIndex + 1}: ${label}`
            : label;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(key);
        }
      });
    });
    return out;
  }

  /** Total project-photo count = staged + already-saved. Used by
   *  the min-3 red-border rule on the Site Photos slot in edit
   *  mode (where the existing 3 might be the only 3). */
  projectPhotosCount(deviceIndex: number): number {
    const staged = this.files[deviceIndex]?.['PROJECT_PHOTOS']?.length ?? 0;
    const existing =
      this.existingDocs[deviceIndex]?.['PROJECT_PHOTOS']?.length ?? 0;
    return staged + existing;
  }

  hasDocFor(deviceIndex: number, docType: string): boolean {
    const ctrlValue = this.deviceForms.at(deviceIndex)?.get(docType)?.value;
    if (ctrlValue) return true;
    const existing = this.existingDocs[deviceIndex]?.[docType];
    return Array.isArray(existing) && existing.length > 0;
  }

  ocrEligibleDocType(docType: string | null | undefined): boolean {
    if (!docType) return true; // unknown context → leave OCR enabled
    return docType !== 'PROJECT_PHOTOS';
  }

  /**
   * Inline OCR button on a staged file row. Show for:
   *   - Metering evidence images (meter screens)
   *   - Contract / declaration PDFs (PROOF_OF_OWNERSHIP, COD_PROOF,
   *     SF_02, SF_02C, OTHER_DOCUMENTS) — text-layer first, raster
   *     fallback.
   * Hidden for site / project photos (no useful text).
   */
  ocrInlineEligible(docType: string, file: File): boolean {
    if (docType === 'PROJECT_PHOTOS') return false;
    const isImage = file.type.startsWith('image/');
    const isPdf =
      file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (docType === 'METERING_EVIDENCE') return isImage || isPdf;
    const contractTypes = new Set([
      'PROOF_OF_OWNERSHIP',
      'COD_PROOF',
      'FORM_SF_02',
      'SF_02',
      'SF_02C',
      'SINGLE_LINE_DIAGRAM',
      'OTHER_DOCUMENTS',
    ]);
    if (contractTypes.has(docType)) return isImage || isPdf;
    return false;
  }

  /**
   * Open a server-saved doc in the preview dialog. Edit-mode only —
   * Add flow has nothing to load. Mirrors edit-device.viewExistingDoc().
   */
  viewExistingDoc(
    doc: { url: string; name: string; id: number },
    docType?: string,
  ): void {
    this.currentPreviewDocType = docType ?? null;
    const ext = doc.name.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    const isPdf = ext === 'pdf';
    const isExcel = ext === 'xlsx' || ext === 'xls';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
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
        this.currentPreviewFile = new File([typed], doc.name, {
          type: typed.type,
        });
        this.previewDialogRef = this.dialog.open(this.previewDialogTemplate, {
          width: '95vw',
          maxWidth: '100vw',
          height: '90vh',
          maxHeight: '100vh',
          panelClass: 'file-preview-dialog',
        });
      },
      error: (err) => {
        const status = err?.status ?? '?';
        const apiMsg = err?.error?.message || err?.message || '';
        const text = apiMsg
          ? `Failed to load "${doc.name}" (HTTP ${status}): ${apiMsg}`
          : `Failed to load "${doc.name}" (HTTP ${status})`;
        // eslint-disable-next-line no-console
        console.error('viewExistingDoc error', { docId: doc.id, err });
        this.toastrService.error(text, '', { timeOut: 8000 });
      },
    });
  }

  /** Delete a server-saved doc; only invoked from edit mode. */
  deleteExistingDoc(deviceIndex: number, type: string, docIndex: number): void {
    const doc = this.existingDocs[deviceIndex]?.[type]?.[docIndex];
    if (!doc) return;
    if (!confirm(`Delete "${doc.label || doc.name}"?`)) return;
    if (!this.editingDeviceId) return;
    this.deviceService
      .deleteDocument(this.editingDeviceId, doc.id)
      .subscribe({
        next: () => {
          this.existingDocs[deviceIndex][type].splice(docIndex, 1);
          if (!this.existingDocs[deviceIndex][type].length) {
            delete this.existingDocs[deviceIndex][type];
            if (this.filePreviews[deviceIndex]?.[type]) {
              delete this.filePreviews[deviceIndex][type];
            }
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

  /**
   * Edit-mode submit. PATCH the existing device via deviceService.update
   * with the first FormArray row's value + any newly-staged files.
   * Mirrors edit-device.component.ts's old onSubmit() but reads from
   * `this.deviceForms.at(0)` instead of `updateDeviceForm`.
   */
  private submitEdit(): void {
    const firstRow = this.deviceForms.at(0) as FormGroup;
    if (!firstRow) {
      this.isSubmitting = false;
      return;
    }

    const selectedCountry: CountryInfo | undefined = this.countrylist.find(
      (option) => option.country === firstRow.value.countryCodename,
    );

    const formValue: any = { ...firstRow.value };
    formValue.countryCode = selectedCountry?.alpha3 ?? formValue.countryCodename;
    delete formValue.countryCodename;
    formValue.organizationId = this.organizationId ?? this.user?.organizationId;
    if (formValue.serialNumber == null) {
      formValue.serialNumber = this.initSerialNumber;
    }

    if (formValue.latitude) {
      const [intLat, decLat] = String(formValue.latitude).split('.');
      formValue.latitude = decLat
        ? `${intLat}.${decLat.slice(0, 20)}`
        : intLat;
    }
    if (formValue.longitude) {
      const [intLng, decLng] = String(formValue.longitude).split('.');
      formValue.longitude = decLng
        ? `${intLng}.${decLng.slice(0, 20)}`
        : intLng;
    }

    if (Array.isArray(formValue.labellingSchemeAccreditation)) {
      formValue.labellingSchemeAccreditation =
        formValue.labellingSchemeAccreditation.join('; ') || null;
    }

    // Strip null/undefined/''/NaN keys so backend skipMissingProperties
    // treats this as a partial update.
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

    // Strip the per-doc-type form-control keys — backend doesn't expect
    // them on the device DTO; they're file-input bindings only.
    for (const ft of this.requiredFileTypes) {
      delete (formValue as any)[ft];
    }
    delete (formValue as any).OTHER_DOCUMENTS;
    delete (formValue as any).sf02EvidenceMode;

    const fileBucket = this.files[0] || ({} as DeviceFiles);
    const fileFields: FileType[] = [
      DocumentType.FORM_SF_02,
      DocumentType.SF_02C,
      DocumentType.PROOF_OF_OWNERSHIP,
      DocumentType.METERING_EVIDENCE,
      DocumentType.SINGLE_LINE_DIAGRAM,
      DocumentType.PROJECT_PHOTOS,
      DocumentType.COD_PROOF,
      DocumentType.OTHER_DOCUMENTS,
    ];
    const hasFiles = fileFields.some((ft) => fileBucket[ft]?.length > 0);

    let payload: FormData | Record<string, any>;
    if (hasFiles) {
      const formData = new FormData();
      formData.append('deviceToUpdate', JSON.stringify(formValue));
      const allowedExtensions = [...DOCUMENTS_EXTENSIONS];
      const maxSizeInMB = 20;
      let allErrors: Record<string, string[]> = {};
      fileFields.forEach((fileType: FileType) => {
        const files = fileBucket[fileType];
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
        this.isSubmitting = false;
        return;
      }
      payload = formData;
    } else {
      payload = formValue;
    }

    const serialChanged =
      formValue.serialNumber !== this.initSerialNumber;

    const sf02Mode = firstRow.get('sf02EvidenceMode')?.value;
    const shouldRegenerateSf02 =
      sf02Mode === 'self' && this.editingDeviceId != null;

    const navigateAway = (): void => {
      if (this.user.role === OrganizationType.Admin) {
        this.router.navigate(['/admin/All_devices']);
      } else if (this.user.role === OrganizationType.Registrant) {
        this.router.navigate(['/registrant/All_devices']);
      } else {
        this.router.navigate(['/device/AllList']);
      }
    };

    this.deviceService
      .update(this.editingExternalId, payload, serialChanged)
      .subscribe({
        next: (data: any) => {
          this.toastrService.success(
            'Updated Successfully !!',
            'Device! ' + (data?.serialNumber ?? this.editingExternalId),
          );
          if (shouldRegenerateSf02) {
            // Regenerate the SF-02 from the now-updated device data,
            // then navigate. Failure to regenerate is non-fatal — the
            // user can re-trigger via the "Re-generate SF-02" button.
            this.http
              .post(
                `${environment.API_URL}device-reviews/${this.editingDeviceId}/generate-sf02`,
                {},
              )
              .subscribe({
                next: () => {
                  this.toastrService.success('SF-02 regenerated', 'SF-02');
                  navigateAway();
                },
                error: (e) => {
                  this.toastrService.warning(
                    e?.error?.message || e?.message || 'Generation failed',
                    'SF-02 — regenerate skipped',
                  );
                  navigateAway();
                },
              });
            return;
          }
          navigateAway();
        },
        error: (err: any) => {
          console.error('error caught in component', err?.error?.message);
          this.submitButtonText = 'Submit';
          this.isSubmitting = false;
          const message =
            err?.error?.message || err?.message || 'Failed to update device';
          if (err.status === 409 || err.error?.statusCode === 409) {
            this.dialog.open(this.errorDialogTemplate, {
              width: '450px',
              data: { title: 'Duplicate Entry', message },
            });
          } else {
            this.toastrService.error(
              message,
              'Device ' + this.editingExternalId,
            );
          }
        },
      });
  }

  openPopupDialog() {
    // Legal confirmation dialog removed — submit directly.
    this.submitForm();
    return;
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

  onMapCenterChanged(
    center: { lat: number; lng: number },
    deviceIndex: number,
  ): void {
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
    const parts = text
      .split(/\t+/)
      .map((s) => s.trim())
      .filter(Boolean);
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
      group
        .get('latitude')
        ?.setValue(this.savedCoords.lat, { emitEvent: false });
      group
        .get('longitude')
        ?.setValue(this.savedCoords.lng, { emitEvent: false });
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
    // Map screenshot of the current site (with EXIF GPS) is saved as a Site Photo.
    if (!this.files[deviceIndex][DocumentType.PROJECT_PHOTOS]) {
      this.files[deviceIndex][DocumentType.PROJECT_PHOTOS] = [];
    }
    this.files[deviceIndex][DocumentType.PROJECT_PHOTOS].push(file);

    if (!this.filePreviews[deviceIndex]) {
      this.filePreviews[deviceIndex] = {};
    }
    const objectUrl = URL.createObjectURL(file);
    this.filePreviews[deviceIndex][DocumentType.PROJECT_PHOTOS] = {
      url: this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl),
      type: 'image',
      name: file.name,
    };

    this.toastrService.success(
      `Map capture "${file.name}" added as a Site Photo (GPS embedded). Submit to upload.`,
      'Captured',
    );
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
