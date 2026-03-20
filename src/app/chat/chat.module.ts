import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChatWindowComponent } from './chat-window/chat-window.component';

@NgModule({
  declarations: [ChatWindowComponent],
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatIconModule,
    MatButtonModule,
  ],
  exports: [ChatWindowComponent],
})
export class ChatModule {}
