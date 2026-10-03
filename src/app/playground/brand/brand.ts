import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-brand',
  template: `<a class="brand" href="/" aria-label="Deep Learning Blocks home"
    ><span class="brand-caption">deep learning</span
    ><span class="letters"
      ><i>B</i><i>L</i><i>O</i><i>C</i><i>K</i><i>S</i><span class="brand-star">✳</span></span
    ></a
  >`,
  styleUrl: './brand.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Brand {}
