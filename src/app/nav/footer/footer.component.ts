import { Component, OnInit } from '@angular/core';
import {
  VersionService,
  AppVersion,
} from '../../auth/services/version.service';

@Component({
  standalone: false,
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent implements OnInit {
  versionLine: string = '';

  constructor(private versionService: VersionService) {}

  ngOnInit() {
    this.versionService.get().subscribe((v) => {
      this.versionLine = this.formatVersion(v);
    });
  }

  private formatVersion(v: AppVersion | null): string {
    if (!v || v.buildTime === 'unknown') return '';
    const sha = v.sha && v.sha !== 'unknown' ? v.sha.slice(0, 8) : '';
    const ts = this.formatBuildTime(v.buildTime);
    if (!ts) return '';
    return sha ? `Last deployed: ${ts} · ${sha}` : `Last deployed: ${ts}`;
  }

  private formatBuildTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
      d.getUTCDate(),
    )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  }
}
