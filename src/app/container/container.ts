import { Component, inject, PLATFORM_ID, afterNextRender, computed, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StageConfig } from 'konva/lib/Stage';
import { CoreShapeComponent, StageComponent } from 'ng2-konva';
import rough from 'roughjs';

@Component({
  selector: 'app-container',
  imports: [StageComponent, CoreShapeComponent],
  templateUrl: './container.html',
  styleUrl: './container.scss',
})
export class Container {
  private readonly platformId = inject(PLATFORM_ID);
  public readonly isBrowser = computed(() => isPlatformBrowser(this.platformId));
  public circleImage = signal<HTMLImageElement | null>(null);

  public configStage: StageConfig = {
    width: 800, // Default fallback values for SSR
    height: 600,
  };

  constructor() {
    // Update dimensions after render when running in browser
    afterNextRender(() => {
      if (this.isBrowser()) {
        this.configStage = {
          ...this.configStage,
          width: window.innerWidth,
          height: window.innerHeight,
        };
        this.generateRoughCircle();
      }
    });
  }

  private generateRoughCircle() {
    // Create a canvas for rough.js
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;

    const rc = rough.canvas(canvas);

    // Draw a rough circle with zig-zag effect and fill
    rc.circle(150, 150, 80, {
      roughness: 2, // Increase for more zig-zag effect
      stroke: 'red',
      strokeWidth: 3,
      fill: 'red', // Add fill
      fillStyle: 'zigzag', // Use zigzag fill pattern
      fillWeight: 2, // Control the density of the zigzag
    });

    // Convert canvas to Image object
    const imageUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      this.circleImage.set(img);
    };
    img.src = imageUrl;
  }
}
