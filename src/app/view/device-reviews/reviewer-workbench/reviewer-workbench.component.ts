import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

interface ChipMapping {
  ocNum: number;
  label: string;
  registrantValue: string;
}

interface DocItem {
  id: string;
  name: string;
  filename: string;
  category: 'site' | 'ownership' | 'metering' | 'photos';
  badge: string;
  size: string;
  isImage: boolean;
  isFacilityBoundary: boolean;
  ocrText?: string;
  chips: ChipMapping[];
}

type OcStatus = 'confirmed' | 'pending' | 'discrepancy';

interface OcRow {
  num: number;
  label: string;
  value: string;
  status: OcStatus;
  comment: string;
  // which docs have ticked this row
  tickedBy: string[];
}

@Component({
  standalone: false,
  selector: 'app-reviewer-workbench',
  templateUrl: './reviewer-workbench.component.html',
  styleUrls: ['./reviewer-workbench.component.scss'],
})
export class ReviewerWorkbenchComponent implements OnInit {
  deviceId = '';
  siteName = 'OMC Power · Bilgram, IN';
  externalId = 'eeb568c3';

  // -- doc list --
  docs: DocItem[] = [
    {
      id: 'sld',
      name: 'Single Line Diagram',
      filename: 'sld_omc_bilgram_2024.pdf',
      category: 'site',
      badge: 'SLD',
      size: '2.1 MB',
      isImage: false,
      isFacilityBoundary: false,
      ocrText:
        'Single Line Diagram — Bilgram MG\nSite: Bilgram, Hardoi, Uttar Pradesh, IN\nOperator: OMC Power Pvt. Ltd.\nCapacity (DC): 27.5 kWp\nCapacity (AC): 25 kW\nInverter: SMA Sunny Tripower 25-3SE\nModules: 50 × Trina Vertex S 550 W\nGrid interconnection: Behind-the-meter, no export\nMeter ID: SMA-2025-08137\nCOD: 2024-03-12',
      chips: [
        { ocNum: 9, label: 'Capacity', registrantValue: '25 kW' },
        { ocNum: 11, label: 'Inverter make/model', registrantValue: 'SMA Sunny Tripower 25' },
        { ocNum: 13, label: 'Module make/model', registrantValue: 'Trina Vertex S 550 W' },
        { ocNum: 14, label: 'Meter ID', registrantValue: 'SMA-2025-08137' },
        { ocNum: 15, label: 'Grid interconnection', registrantValue: 'true (behind-the-meter)' },
        { ocNum: 16, label: 'Grid export type', registrantValue: 'none' },
        { ocNum: 24, label: 'Auxiliary energy sources', registrantValue: 'No' },
      ],
    },
    {
      id: 'nameplate',
      name: 'Nameplate photo',
      filename: 'nameplate_inverter.jpg',
      category: 'site',
      badge: 'JPG',
      size: '1.8 MB',
      isImage: true,
      isFacilityBoundary: false,
      chips: [
        { ocNum: 9, label: 'Capacity', registrantValue: '25 kW' },
        { ocNum: 11, label: 'Inverter make/model', registrantValue: 'SMA Sunny Tripower 25' },
      ],
    },
    {
      id: 'cod',
      name: 'COD proof',
      filename: 'cod_letter_2024.pdf',
      category: 'site',
      badge: 'COD_PROOF',
      size: '820 KB',
      isImage: false,
      isFacilityBoundary: false,
      chips: [{ ocNum: 8, label: 'Commercial operation date', registrantValue: '2024-03-12' }],
    },
    {
      id: 'boundary',
      name: 'Facility boundary',
      filename: 'satellite_view_q4.png',
      category: 'site',
      badge: 'SAT',
      size: '4.2 MB',
      isImage: true,
      isFacilityBoundary: true,
      chips: [
        { ocNum: 3, label: 'Site coordinates', registrantValue: '27.18, 80.45' },
        { ocNum: 44, label: 'Facility boundary', registrantValue: 'uploaded' },
      ],
    },
    {
      id: 'ownership',
      name: 'Ownership declaration',
      filename: 'ownership_decl.pdf',
      category: 'ownership',
      badge: 'PDF',
      size: '1.3 MB',
      isImage: false,
      isFacilityBoundary: false,
      chips: [
        { ocNum: 47, label: 'PV system owner', registrantValue: 'OMC Power Pvt. Ltd.' },
        { ocNum: 1, label: 'Operator name', registrantValue: 'OMC Power' },
      ],
    },
    {
      id: 'odletter',
      name: 'OD letter (off-taker)',
      filename: 'od_letter_offtaker.pdf',
      category: 'ownership',
      badge: 'OD_LETTER',
      size: '980 KB',
      isImage: false,
      isFacilityBoundary: false,
      chips: [
        { ocNum: 23, label: 'Captive consumer', registrantValue: 'Yes' },
        { ocNum: 47, label: 'PV system owner', registrantValue: 'OMC Power Pvt. Ltd.' },
        { ocNum: 46, label: 'OD letter upload', registrantValue: 'present' },
      ],
    },
    {
      id: 'metering',
      name: 'Meter reading log Q4',
      filename: 'meter_log_q4_2024.csv',
      category: 'metering',
      badge: 'METERING_EVIDENCE',
      size: '340 KB',
      isImage: false,
      isFacilityBoundary: false,
      chips: [
        { ocNum: 14, label: 'Meter ID', registrantValue: 'SMA-2025-08137' },
        { ocNum: 49, label: 'Metering evidence', registrantValue: 'Q4 2024 log' },
      ],
    },
    {
      id: 'photo1',
      name: 'Rooftop array — N view',
      filename: 'rooftop_n.jpg',
      category: 'photos',
      badge: 'JPG · GPS',
      size: '3.6 MB',
      isImage: true,
      isFacilityBoundary: false,
      chips: [
        { ocNum: 3, label: 'Site coordinates', registrantValue: '27.18, 80.45' },
        { ocNum: 44, label: 'Facility boundary', registrantValue: 'uploaded' },
      ],
    },
    {
      id: 'photo2',
      name: 'Rooftop array — S view',
      filename: 'rooftop_s.jpg',
      category: 'photos',
      badge: 'JPG · GPS',
      size: '3.4 MB',
      isImage: true,
      isFacilityBoundary: false,
      chips: [
        { ocNum: 3, label: 'Site coordinates', registrantValue: '27.18, 80.45' },
        { ocNum: 13, label: 'Module make/model', registrantValue: 'Trina Vertex S 550 W' },
      ],
    },
  ];

  selectedDocId = 'sld';
  ocrOpen = false;
  satOverlayOpen = false;

  // -- OC# state --
  ocRows: OcRow[] = [
    { num: 1, label: 'Operator name', value: 'OMC Power', status: 'confirmed', comment: '', tickedBy: ['ownership'] },
    { num: 3, label: 'Site coordinates', value: '27.180, 80.448', status: 'confirmed', comment: '', tickedBy: ['boundary', 'photo1'] },
    { num: 5, label: 'Country', value: 'IND', status: 'discrepancy', comment: "reg said 'IND', SLD lists 'India' — accept", tickedBy: [] },
    { num: 8, label: 'Commercial operation date', value: '2024-03-12', status: 'confirmed', comment: '', tickedBy: ['cod'] },
    { num: 9, label: 'Capacity', value: '25 kW', status: 'confirmed', comment: '', tickedBy: ['sld'] },
    { num: 10, label: 'DC vs AC capacity', value: '27.5 / 25', status: 'pending', comment: '', tickedBy: [] },
    { num: 11, label: 'Inverter', value: 'SMA STP 25-3SE', status: 'confirmed', comment: '', tickedBy: ['sld'] },
    { num: 13, label: 'Module', value: 'Trina Vertex S 550W', status: 'confirmed', comment: '', tickedBy: ['sld'] },
    { num: 14, label: 'Meter / serial IDs', value: 'SMA-2025-08137', status: 'confirmed', comment: '', tickedBy: ['sld'] },
    { num: 15, label: 'Grid interconnection', value: 'true', status: 'confirmed', comment: '', tickedBy: ['sld'] },
    { num: 16, label: 'Grid export type', value: 'none', status: 'pending', comment: '', tickedBy: [] },
    { num: 22, label: 'Operating configuration', value: 'GridNoExport', status: 'pending', comment: '', tickedBy: [] },
    { num: 23, label: 'Captive consumer', value: 'Yes', status: 'discrepancy', comment: "OD letter says 'on-site only', SLD shows local-load topology — consistent", tickedBy: [] },
    { num: 24, label: 'Aux energy sources', value: 'No', status: 'confirmed', comment: '', tickedBy: [] },
    { num: 26, label: 'Submitter status', value: 'Operator', status: 'pending', comment: '', tickedBy: [] },
    { num: 33, label: 'Public funding end', value: '—', status: 'confirmed', comment: '', tickedBy: [] },
    { num: 34, label: 'Subsidy received', value: 'No', status: 'confirmed', comment: '', tickedBy: [] },
    { num: 35, label: 'Subsidy types', value: '—', status: 'pending', comment: '', tickedBy: [] },
    { num: 37, label: 'Labelling scheme', value: 'D-REC', status: 'pending', comment: '', tickedBy: [] },
    { num: 42, label: 'Signature', value: '—', status: 'pending', comment: '', tickedBy: [] },
    { num: 44, label: 'Facility boundary', value: 'uploaded', status: 'pending', comment: '', tickedBy: [] },
    { num: 46, label: 'OD letter upload', value: 'present', status: 'pending', comment: '', tickedBy: [] },
    { num: 47, label: 'PV system owner', value: 'OMC Power', status: 'discrepancy', comment: "ownership decl says 'OMC Power Pvt Ltd', OD letter says 'OMC Power Inc' — likely typo", tickedBy: [] },
    { num: 49, label: 'Metering evidence', value: 'Q4 2024 log', status: 'pending', comment: '', tickedBy: [] },
    { num: 50, label: 'Off-grid circumstances', value: 'n/a', status: 'pending', comment: '', tickedBy: [] },
  ];

  filterMode: 'all' | 'commented' | 'unticked' = 'all';

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.deviceId = this.route.snapshot.paramMap.get('id') || 'demo';
  }

  get selectedDoc(): DocItem | undefined {
    return this.docs.find((d) => d.id === this.selectedDocId);
  }

  selectDoc(id: string) {
    this.selectedDocId = id;
    // close OCR pane on doc switch — fresh content
    this.ocrOpen = false;
  }

  isChipTicked(chip: ChipMapping): boolean {
    const row = this.ocRows.find((r) => r.num === chip.ocNum);
    return !!row?.tickedBy.includes(this.selectedDocId);
  }

  toggleChip(chip: ChipMapping) {
    const row = this.ocRows.find((r) => r.num === chip.ocNum);
    if (!row) return;
    const idx = row.tickedBy.indexOf(this.selectedDocId);
    if (idx >= 0) {
      row.tickedBy.splice(idx, 1);
    } else {
      row.tickedBy.push(this.selectedDocId);
    }
    // recompute status: confirmed if any doc ticks it, pending if none + no comment, discrepancy preserved
    if (row.status !== 'discrepancy') {
      row.status = row.tickedBy.length > 0 ? 'confirmed' : 'pending';
    }
  }

  onCommentChange(row: OcRow, value: string) {
    row.comment = value;
  }

  get docCategoryGroups(): { label: string; docs: DocItem[] }[] {
    const groups = [
      { key: 'site' as const, label: 'Site & identification' },
      { key: 'ownership' as const, label: 'Ownership & funding' },
      { key: 'metering' as const, label: 'Metering' },
      { key: 'photos' as const, label: 'Site photos' },
    ];
    return groups
      .map((g) => ({ label: g.label, docs: this.docs.filter((d) => d.category === g.key) }))
      .filter((g) => g.docs.length > 0);
  }

  get filteredOcRows(): OcRow[] {
    if (this.filterMode === 'commented') return this.ocRows.filter((r) => r.comment.trim().length > 0);
    if (this.filterMode === 'unticked') return this.ocRows.filter((r) => r.tickedBy.length === 0);
    return this.ocRows;
  }

  get progress() {
    const confirmed = this.ocRows.filter((r) => r.status === 'confirmed').length;
    const discrepancies = this.ocRows.filter((r) => r.status === 'discrepancy').length;
    const pending = this.ocRows.filter((r) => r.status === 'pending').length;
    const total = this.ocRows.length;
    return {
      confirmed,
      discrepancies,
      pending,
      total,
      percent: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      filterAll: total,
      filterCommented: this.ocRows.filter((r) => r.comment.trim().length > 0).length,
      filterUnticked: this.ocRows.filter((r) => r.tickedBy.length === 0).length,
    };
  }

  hasChipsForDoc(d: DocItem): boolean {
    return d.chips.length > 0;
  }

  isFullyChecked(d: DocItem): boolean {
    if (d.chips.length === 0) return false;
    return d.chips.every((c) => {
      const row = this.ocRows.find((r) => r.num === c.ocNum);
      return !!row?.tickedBy.includes(d.id);
    });
  }

  toggleOcr() {
    this.ocrOpen = !this.ocrOpen;
  }

  onSubmit() {
    alert('Submit review — wire up next pass');
  }

  onReject() {
    alert('Reject for re-submission — wire up next pass');
  }
}
