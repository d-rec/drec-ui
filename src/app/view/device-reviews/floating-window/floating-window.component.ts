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
    this.x = this.initX;
    this.y = Math.max(0, this.initY);
    // Cap requested initial size to ~70% of the viewport so windows
    // open visibly inside the screen instead of swallowing it.
    // Floor of 320×240 so nothing collapses to nothing on tiny windows.
    const maxW = Math.max(320, Math.round(window.innerWidth * 0.7));
    const maxH = Math.max(240, Math.round(window.innerHeight * 0.7));
    this.width = Math.min(this.initWidth, maxW);
    this.height = Math.min(this.initHeight, maxH);
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
      this.width = Math.max(
        260,
        this.resizeStartW + (event.clientX - this.resizeStartX),
      );
      this.height = Math.max(
        140,
        this.resizeStartH + (event.clientY - this.resizeStartY),
      );
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.dragging = false;
    this.resizing = false;
  }
}
