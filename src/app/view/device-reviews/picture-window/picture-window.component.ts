import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AssetService } from '../asset.service';

@Component({
  standalone: false,
  selector: 'app-ds-picture-window',
  templateUrl: './picture-window.component.html',
  styleUrls: ['./picture-window.component.scss'],
})
export class PictureWindowComponent implements OnInit, OnDestroy {
  @Input() zIndex = 400;
  @Output() bringToFront = new EventEmitter<void>();

  readonly url$ = this.svc.viewPictureUrl$;
  private sub!: Subscription;

  constructor(readonly svc: AssetService) {}

  ngOnInit(): void {
    this.sub = this.svc.viewPictureUrl$.subscribe(url => {
      if (url) this.bringToFront.emit();
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  close(): void {
    this.svc.viewPicture(null);
  }
}
