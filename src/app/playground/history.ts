import { Board } from './graph';
export class BoardHistory {
  private past: Board[] = [];
  private future: Board[] = [];
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  record(before: Board): void {
    this.past = [...this.past.slice(-49), structuredClone(before)];
    this.future = [];
  }
  undo(current: Board): Board | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(structuredClone(current));
    return { ...previous, viewport: current.viewport };
  }
  redo(current: Board): Board | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(structuredClone(current));
    return { ...next, viewport: current.viewport };
  }
  clear(): void {
    this.past = [];
    this.future = [];
  }
}
