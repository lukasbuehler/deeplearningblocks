import { MatIcon } from '@angular/material/icon';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { GameService } from '../game.service';
import { DigitPreview } from '../../learning/digit-preview/digit-preview';
import { normalizeDigit } from './normalize-digit';
@Component({
  selector: 'app-digit-pad',
  imports: [MatIcon, CdkTrapFocus, DigitPreview],
  templateUrl: './digit-pad.html',
  styleUrl: './digit-pad.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DigitPad {
  readonly game = inject(GameService);
  readonly close = output<void>();
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('pad');
  readonly preview = signal<Float32Array | undefined>(undefined);
  private last?: { x: number; y: number };
  private pointer?: number;
  constructor() {
    afterNextRender(() => this.clear());
  }
  clear(): void {
    const context = this.canvas().nativeElement.getContext('2d')!;
    context.fillStyle = '#000';
    context.fillRect(0, 0, 280, 280);
    this.preview.set(undefined);
  }
  draw(event: PointerEvent): void {
    if (event.type === 'pointerdown') {
      if (event.button !== 0) return;
      this.pointer = event.pointerId;
      this.canvas().nativeElement.setPointerCapture(event.pointerId);
    }
    if (this.pointer !== event.pointerId) return;
    event.preventDefault();
    const canvas = this.canvas().nativeElement,
      r = canvas.getBoundingClientRect(),
      p = {
        x: ((event.clientX - r.left) * 280) / r.width,
        y: ((event.clientY - r.top) * 280) / r.height,
      };
    const context = canvas.getContext('2d')!;
    context.strokeStyle = '#fff';
    context.fillStyle = '#fff';
    context.lineWidth = 19;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(this.last?.x ?? p.x, this.last?.y ?? p.y);
    context.lineTo(p.x, p.y);
    context.stroke();
    if (!this.last) {
      context.beginPath();
      context.arc(p.x, p.y, 9.5, 0, Math.PI * 2);
      context.fill();
    }
    this.last = p;
  }
  finish(): void {
    this.last = undefined;
    this.pointer = undefined;
    const data = this.canvas().nativeElement.getContext('2d')!.getImageData(0, 0, 280, 280);
    this.preview.set(normalizeDigit(data.data, 280, 280) ?? undefined);
  }
  use(): void {
    const pixels = this.preview();
    if (pixels) {
      this.game.useDrawing(pixels);
      this.close.emit();
    }
  }
}
