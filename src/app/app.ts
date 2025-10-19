import {
  Component,
  signal,
  ChangeDetectionStrategy,
  effect,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { Container } from './container/container';

@Component({
  selector: 'app-root',
  imports: [MatIconButton, MatIcon, Container],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly title = signal('Deep Learning Blocks');
  protected readonly isDarkMode = signal(false);

  constructor() {
    // Initialize dark mode from localStorage or system preference
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        this.isDarkMode.set(true);
      } else if (savedTheme === 'light') {
        this.isDarkMode.set(false);
      } else {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.isDarkMode.set(prefersDark);
      }
    }

    // Apply theme changes
    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        const darkMode = this.isDarkMode();
        document.body.classList.toggle('dark-theme', darkMode);
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
      }
    });
  }

  protected toggleTheme(): void {
    this.isDarkMode.update((current) => !current);
  }
}
