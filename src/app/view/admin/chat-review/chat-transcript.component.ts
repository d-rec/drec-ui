import {
  AfterViewChecked,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { ChatMessage } from '../../../chat/chat.service';

/**
 * Read-only transcript renderer. Pure presentation — no input box, no
 * API calls, no auto-scroll on incoming (since this is historical data).
 *
 * Each message bubble is colored by which participant authored it
 * (participant1 vs participant2 vs "other" for system / admin notes
 * appended via auto-log).
 */
@Component({
  standalone: false,
  selector: 'app-chat-transcript',
  templateUrl: './chat-transcript.component.html',
  styleUrls: ['./chat-transcript.component.scss'],
})
export class ChatTranscriptComponent implements OnChanges, AfterViewChecked {
  @Input() messages: ChatMessage[] = [];
  @Input() participant1 = '';
  @Input() participant2 = '';
  @Input() siteName: string | null = null;

  @ViewChild('scroll', { static: false })
  scroll?: ElementRef<HTMLDivElement>;

  private shouldScrollToBottom = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages']) this.shouldScrollToBottom = true;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom && this.scroll) {
      this.scroll.nativeElement.scrollTop =
        this.scroll.nativeElement.scrollHeight;
      this.shouldScrollToBottom = false;
    }
  }

  bubbleClass(msg: ChatMessage): string {
    if (msg.username === this.participant1) return 'rt__bubble rt__bubble--p1';
    if (msg.username === this.participant2) return 'rt__bubble rt__bubble--p2';
    return 'rt__bubble rt__bubble--other';
  }
}
