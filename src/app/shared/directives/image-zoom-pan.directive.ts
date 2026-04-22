import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';

/**
 * Adds scroll-wheel zoom, click-drag pan, pinch-zoom, and double-click-reset to
 * an element. The host element is transformed; size stays the same so any
 * overlaid elements (e.g. canvas) stay aligned.
 *
 * A mousedown + drag only starts panning once movement exceeds `dragThreshold`,
 * so inner clickable elements (e.g. a detection overlay canvas) still receive
 * plain clicks.
 */
@Directive({
  standalone: true,
  selector: '[appImageZoomPan]',
})
export class ImageZoomPanDirective implements OnChanges, OnDestroy {
  @Input('appImageZoomPan') enabled: boolean | '' = true;
  /** Reset transform when this value changes (e.g. bind to the image URL). */
  @Input() resetKey: any = null;
  @Input() minScale = 1;
  @Input() maxScale = 8;

  private scale = 1;
  private tx = 0;
  private ty = 0;

  private dragging = false;
  private dragStarted = false;
  private dragOriginX = 0;
  private dragOriginY = 0;
  private startTx = 0;
  private startTy = 0;
  private readonly dragThreshold = 4;

  private pinchStartDist = 0;
  private pinchStartScale = 1;

  constructor(private host: ElementRef<HTMLElement>) {
    const el = this.host.nativeElement;
    el.style.transformOrigin = '0 0';
    el.style.willChange = 'transform';
    el.style.touchAction = 'none';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resetKey']) this.reset();
  }

  ngOnDestroy(): void {
    this.detachWindowListeners();
  }

  private isEnabled(): boolean {
    return this.enabled !== false;
  }

  reset(): void {
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.apply();
  }

  private apply(): void {
    this.host.nativeElement.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    if (!this.isEnabled()) return;
    event.preventDefault();
    const rect = this.host.nativeElement.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.zoomAt(cx, cy, factor);
  }

  @HostListener('dblclick', ['$event'])
  onDblClick(event: MouseEvent): void {
    if (!this.isEnabled()) return;
    event.preventDefault();
    event.stopPropagation();
    this.reset();
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (!this.isEnabled() || event.button !== 0) return;
    this.dragging = true;
    this.dragStarted = false;
    this.dragOriginX = event.clientX;
    this.dragOriginY = event.clientY;
    this.startTx = this.tx;
    this.startTy = this.ty;
    window.addEventListener('mousemove', this.onWindowMouseMove, true);
    window.addEventListener('mouseup', this.onWindowMouseUp, true);
  }

  private onWindowMouseMove = (event: MouseEvent) => {
    if (!this.dragging) return;
    const dx = event.clientX - this.dragOriginX;
    const dy = event.clientY - this.dragOriginY;
    if (!this.dragStarted) {
      if (Math.hypot(dx, dy) < this.dragThreshold) return;
      this.dragStarted = true;
      this.host.nativeElement.style.cursor = 'grabbing';
    }
    event.preventDefault();
    this.tx = this.startTx + dx;
    this.ty = this.startTy + dy;
    this.apply();
  };

  private onWindowMouseUp = (event: MouseEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    this.host.nativeElement.style.cursor = '';
    this.detachWindowListeners();
    if (this.dragStarted) {
      // Swallow the click that would fire on inner elements after a real drag.
      event.stopPropagation();
      const swallow = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        window.removeEventListener('click', swallow, true);
      };
      window.addEventListener('click', swallow, true);
    }
  };

  private detachWindowListeners(): void {
    window.removeEventListener('mousemove', this.onWindowMouseMove, true);
    window.removeEventListener('mouseup', this.onWindowMouseUp, true);
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (!this.isEnabled()) return;
    if (event.touches.length === 2) {
      event.preventDefault();
      this.pinchStartDist = this.touchDist(event);
      this.pinchStartScale = this.scale;
    } else if (event.touches.length === 1) {
      this.dragging = true;
      this.dragStarted = true;
      this.dragOriginX = event.touches[0].clientX;
      this.dragOriginY = event.touches[0].clientY;
      this.startTx = this.tx;
      this.startTy = this.ty;
    }
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.isEnabled()) return;
    if (event.touches.length === 2 && this.pinchStartDist > 0) {
      event.preventDefault();
      const dist = this.touchDist(event);
      const factor = dist / this.pinchStartDist;
      const nextScale = this.clamp(
        this.pinchStartScale * factor,
        this.minScale,
        this.maxScale,
      );
      const rect = this.host.nativeElement.getBoundingClientRect();
      const cx =
        (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      const cy =
        (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
      this.setScaleAt(cx, cy, nextScale);
    } else if (event.touches.length === 1 && this.dragging) {
      event.preventDefault();
      const dx = event.touches[0].clientX - this.dragOriginX;
      const dy = event.touches[0].clientY - this.dragOriginY;
      this.tx = this.startTx + dx;
      this.ty = this.startTy + dy;
      this.apply();
    }
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    if (event.touches.length < 2) this.pinchStartDist = 0;
    if (event.touches.length === 0) this.dragging = false;
  }

  private touchDist(event: TouchEvent): number {
    const [a, b] = [event.touches[0], event.touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  private zoomAt(cx: number, cy: number, factor: number): void {
    const next = this.clamp(this.scale * factor, this.minScale, this.maxScale);
    this.setScaleAt(cx, cy, next);
  }

  private setScaleAt(cx: number, cy: number, nextScale: number): void {
    // Keep the point under (cx, cy) stationary across the zoom
    const ratio = nextScale / this.scale;
    this.tx = cx - (cx - this.tx) * ratio;
    this.ty = cy - (cy - this.ty) * ratio;
    this.scale = nextScale;
    if (this.scale === this.minScale) {
      this.tx = 0;
      this.ty = 0;
    }
    this.apply();
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}
