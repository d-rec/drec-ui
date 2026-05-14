import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  HostListener,
  ChangeDetectorRef,
  ElementRef,
} from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-ds-floating-window',
  templateUrl: './floating-window.component.html',
  styleUrls: ['./floating-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingWindowComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @Input() title = '';
  @Input() initX = 20;
  @Input() initY = 20;
  @Input() initWidth = 480;
  @Input() initHeight = 340;
  /** Optional cap on width/height ratio. When set, resize clamps width to
   *  height * maxAspectRatio (and height to width / maxAspectRatio). The
   *  satellite window uses this so detected-panel scans stay roughly
   *  square — Roboflow handles wide aspect ratios poorly. */
  @Input() maxAspectRatio: number | null = null;
  @Input() zIndex = 100;
  @Output() bringToFront = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  x = 0;
  y = 0;
  width = 0;
  height = 0;

  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  private resizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartW = 0;
  private resizeStartH = 0;

  constructor(
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    // Hard-cap the right/bottom edge to viewport - 24px so the resize handle
    // is always reachable. Position from initX/initY but pull back if the
    // requested size+pos would push the right/bottom edge off-screen.
    const padding = 24;
    const maxRight = window.innerWidth - padding;
    const maxBottom = window.innerHeight - padding;
    this.x = Math.max(0, Math.min(this.initX, maxRight - 320));
    this.y = Math.max(0, Math.min(this.initY, maxBottom - 240));
    const maxW = Math.max(320, maxRight - this.x);
    const maxH = Math.max(240, maxBottom - this.y);
    this.width = Math.min(this.initWidth, maxW);
    this.height = Math.min(this.initHeight, maxH);
    if (this.maxAspectRatio !== null && this.maxAspectRatio > 0) {
      this.width = Math.min(this.width, Math.round(this.height * this.maxAspectRatio));
    }
  }

  /**
   * Move the host element to document.body so the window escapes every
   * ancestor stacking context (e.g. mat-sidenav-container's z-index:0).
   * Without this, the window z-index can't beat the app header/sidenav.
   */
  ngAfterViewInit(): void {
    const host = this.elementRef.nativeElement;
    if (host.parentNode !== document.body) {
      document.body.appendChild(host);
    }
  }

  ngOnDestroy(): void {
    const host = this.elementRef.nativeElement;
    host.parentNode?.removeChild(host);
  }

  onTitlebarMousedown(event: MouseEvent): void {
    this.dragging = true;
    this.dragOffsetX = event.clientX - this.x;
    this.dragOffsetY = event.clientY - this.y;
    this.bringToFront.emit();
    event.preventDefault();
  }

  onResizeMousedown(event: MouseEvent): void {
    this.resizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartW = this.width;
    this.resizeStartH = this.height;
    this.bringToFront.emit();
    event.preventDefault();
    event.stopPropagation();
  }

  onBodyMousedown(): void {
    this.bringToFront.emit();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.dragging) {
      this.x = event.clientX - this.dragOffsetX;
      this.y = event.clientY - this.dragOffsetY;
      if (this.y < 0) this.y = 0;
      if (this.x < -(this.width - 80)) this.x = -(this.width - 80);
      this.cdr.markForCheck();
    } else if (this.resizing) {
      // Clamp so the user can't drag the window wider/taller than the viewport.
      // Otherwise the bottom-right resize handle ends up off-screen and the
      // window becomes unreachable.
      const maxW = Math.max(320, window.innerWidth - this.x - 8);
      const maxH = Math.max(140, window.innerHeight - this.y - 8);
      let nextW = Math.min(
        maxW,
        Math.max(260, this.resizeStartW + (event.clientX - this.resizeStartX)),
      );
      let nextH = Math.min(
        maxH,
        Math.max(140, this.resizeStartH + (event.clientY - this.resizeStartY)),
      );
      if (this.maxAspectRatio !== null && this.maxAspectRatio > 0) {
        nextW = Math.min(nextW, Math.round(nextH * this.maxAspectRatio));
        nextH = Math.min(nextH, Math.round(nextW / this.maxAspectRatio));
      }
      this.width = nextW;
      this.height = nextH;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.dragging = false;
    this.resizing = false;
  }
}
