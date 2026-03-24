import {
  Component, Input, Output, EventEmitter, OnInit,
  ChangeDetectionStrategy, HostListener, ChangeDetectorRef,
} from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-ds-floating-window',
  templateUrl: './floating-window.component.html',
  styleUrls: ['./floating-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingWindowComponent implements OnInit {
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

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.x = this.initX;
    this.y = this.initY;
    this.width = this.initWidth;
    this.height = this.initHeight;
  }

  onTitlebarMousedown(event: MouseEvent): void {
    this.dragging = true;
    this.dragOffsetX = event.clientX - this.x;
    this.dragOffsetY = event.clientY - this.y;
    this.bringToFront.emit();
    event.preventDefault();
  }

  onBodyMousedown(): void {
    this.bringToFront.emit();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.dragging) return;
    this.x = event.clientX - this.dragOffsetX;
    this.y = event.clientY - this.dragOffsetY;
    this.cdr.markForCheck();
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.dragging = false;
  }
}
