import {
  Component,
  inject,
  PLATFORM_ID,
  afterNextRender,
  computed,
  signal,
  effect,
} from '@angular/core';
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
  public gridImage = signal<HTMLImageElement | null>(null);
  public isDarkMode = signal(false);

  public configStage: StageConfig = {
    width: 800, // Default fallback values for SSR
    height: 600,
  };

  constructor() {
    // Check for dark mode preference
    effect(() => {
      if (this.isBrowser()) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.isDarkMode.set(isDark);

        // Listen for changes in color scheme preference
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => this.isDarkMode.set(e.matches);
        mediaQuery.addEventListener('change', handler);
      }
    });

    // Update dimensions after render when running in browser
    afterNextRender(() => {
      if (this.isBrowser()) {
        this.configStage = {
          ...this.configStage,
          width: window.innerWidth,
          height: window.innerHeight,
        };
        this.generateScribblyGrid();
        this.generateRoughCircle();
      }
    });
  }

  private generateScribblyGrid() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const gridSize = 40; // Grid cell size

    // Create a canvas for the grid
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridColor = this.isDarkMode() ? '#64b5f6' : '#2d3748'; // Blue for dark mode, darker gray for light mode

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.2;

    // Draw vertical lines
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Convert canvas to Image object
    const imageUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      this.gridImage.set(img);
    };
    img.src = imageUrl;
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
