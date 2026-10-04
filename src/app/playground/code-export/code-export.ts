import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { GameService } from '../game.service';
import { pytorchModel, pytorchNotebook, pytorchScript } from '../pytorch-export';

@Component({
  selector: 'app-code-export',
  imports: [CdkTrapFocus],
  templateUrl: './code-export.html',
  styleUrl: './code-export.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeExport {
  readonly game = inject(GameService);
  readonly close = output<void>();
  readonly fullRecipe = signal(false);
  readonly status = signal('');
  readonly network = computed(() => this.game.compilation().network);
  readonly code = computed(() => {
    const network = this.network();
    return network
      ? this.fullRecipe()
        ? pytorchScript(network, this.game.dataset())
        : pytorchModel(network)
      : '';
  });
  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.status.set('Copied! Paste it into your Python editor.');
    } catch {
      this.status.set('Copy is unavailable here. Select the code or download the Python file.');
    }
  }
  download(format: 'py' | 'ipynb'): void {
    const network = this.network();
    if (!network) return;
    const content =
      format === 'py'
        ? pytorchScript(network, this.game.dataset())
        : pytorchNotebook(network, this.game.dataset());
    const blob = new Blob([content], {
      type: format === 'py' ? 'text/x-python;charset=utf-8' : 'application/x-ipynb+json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deep-learning-blocks.${format}`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.status.set(
      format === 'py'
        ? 'Python file ready. Install torch and torchvision, then run it.'
        : 'Notebook ready. Open Colab, choose File → Upload notebook, then select this file.',
    );
  }
}
