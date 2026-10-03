import { ChangeDetectionStrategy, Component, effect, ElementRef, input, viewChild } from '@angular/core';

@Component({
  selector: 'app-digit-preview',
  template: '<canvas #canvas width="28" height="28" role="img" [attr.aria-label]="label()"></canvas>',
  styles: ':host { display: block; aspect-ratio: 1; } canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; border-radius: 10px; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DigitPreview {
  readonly pixels = input<Float32Array>();
  readonly label = input('Handwritten MNIST digit');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  constructor() {
    effect(() => {
      const ctx = this.canvas()?.nativeElement.getContext('2d'), pixels = this.pixels();
      if (!ctx) return;
      const image = ctx.createImageData(28, 28);
      for (let i = 0; i < 784; i++) {
        const value = Math.round((pixels?.[i] ?? 0) * 235);
        image.data.set([23 + value * .9, 28 + value * .85, 31 + value * .8, 255], i * 4);
      }
      ctx.putImageData(image, 0, 0);
    });
  }
}
