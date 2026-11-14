import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from '../../app';
import { freshGame } from '../storage';
import { transformerBoard } from '../text-fixtures';
import { compileBoard, portPosition } from '../graph';

async function setup(full = true) {
  TestBed.configureTestingModule({ imports: [App], providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(App);
  const game = fixture.componentInstance.game;
  const save = freshGame();
  save.era = 3;
  game.save.set(save);
  game.switchLevel('attention');
  if (full) game.edit(transformerBoard());
  await fixture.whenStable();
  const canvas = fixture.componentInstance.canvas()!;
  game.setViewport({ x: 0, y: 0, zoom: 1 });
  await fixture.whenStable();
  return { fixture, game, canvas };
}

describe('Shakespeare building interactions', () => {
  it('offers the classic start, an optional recipe and colored text tiles; custom tiles add empty recipes', async () => {
    const { fixture, game, canvas } = await setup(false);
    expect(game.prompt()).toBe('To be or ');
    expect(game.snippet()).toEqual({ letters: 'To be or ', next: 'n' });
    const recipe = fixture.nativeElement.querySelector('.text-recipe') as HTMLDetailsElement;
    expect(recipe.open).toBeFalse();
    expect(recipe.querySelectorAll('li').length).toBe(6);
    canvas.tray.set(true);
    await fixture.whenStable();
    for (const kind of [
      'text',
      'embedding',
      'position',
      'layernorm',
      'attention',
      'add',
      'writer',
    ]) {
      const tile = fixture.nativeElement.querySelector('.tile.' + kind) as HTMLElement;
      expect(getComputedStyle(tile).getPropertyValue('--tile-color').trim()).not.toBe('');
    }
    const tile = canvas.tiles().find((t) => t.kind === 'custom')!;
    canvas.add(tile);
    await fixture.whenStable();
    const group = game.board().nodes.find((n) => n.kind === 'custom')!;
    expect(group.blocks).toEqual([]);
    game.configure({ id: group.id, name: 'My recipe', repeat: 2 });
    expect(game.board().nodes.find((n) => n.id === group.id)!.repeat).toBe(2);
    fixture.destroy();
  });

  it('drags a shortcut from its visible handle, parks its plate and reconnects it to Add', async () => {
    const { fixture, game, canvas } = await setup();
    const original = compileBoard(game.board()).network!.signature;
    game.edit({
      ...game.board(),
      edges: game.board().edges.filter((e) => !(e.from === 'pos' && e.port)),
    });
    await fixture.whenStable();
    const knob = fixture.nativeElement.querySelector(
      '[data-node="pos"] .shortcut-knob',
    ) as HTMLElement;
    spyOn(knob, 'setPointerCapture').and.stub();
    const rect = canvas.paper().nativeElement.getBoundingClientRect();
    const point = { x: 1000, y: 1000 };
    knob.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 1,
        button: 0,
        clientX: rect.left + 330,
        clientY: rect.top + 550,
      }),
    );
    knob.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 1,
        clientX: rect.left + point.x,
        clientY: rect.top + point.y,
      }),
    );
    await fixture.whenStable();
    expect(canvas.shortcutDrag()).not.toBeNull();
    expect(game.board().parked?.length ?? 0).toBe(0);
    knob.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 1,
        clientX: rect.left + point.x,
        clientY: rect.top + point.y,
      }),
    );
    await fixture.whenStable();
    expect(canvas.shortcutDrag()).toBeNull();
    expect(game.board().parked).toEqual([{ from: 'pos', ...point }]);
    const plate = fixture.nativeElement.querySelector(
      '[aria-label^="Shortcut plate from pos"]',
    ) as HTMLElement;
    spyOn(plate, 'setPointerCapture').and.stub();
    const socket = portPosition(
      game.board().nodes.find((n) => n.id === 'add1')!,
      'input',
      'skip',
    );
    plate.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 2,
        button: 0,
        clientX: rect.left + point.x,
        clientY: rect.top + point.y,
      }),
    );
    plate.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 2,
        clientX: rect.left + socket.x,
        clientY: rect.top + socket.y,
      }),
    );
    await fixture.whenStable();
    expect(canvas.shortcutCandidate()?.error).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-node="add1"] .connector-glow.valid'),
    ).toBeTruthy();
    plate.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 2,
        clientX: rect.left + socket.x,
        clientY: rect.top + socket.y,
      }),
    );
    await fixture.whenStable();
    expect(game.board().parked?.length).toBe(0);
    expect(compileBoard(game.board()).network!.signature).toBe(original);
    fixture.destroy();
  });

  it('deletes a recipe part through the trash and restores it with one Undo', async () => {
    const { fixture, game, canvas } = await setup(false);
    game.edit({
      ...game.board(),
      nodes: [
        ...game.board().nodes,
        {
          id: 'group',
          kind: 'custom',
          blocks: [{ id: 'part', kind: 'dense', units: 48 }],
          repeat: 2,
          x: 100,
          y: 100,
        },
      ],
    });
    await fixture.whenStable();
    const r = canvas.trash()!.nativeElement.getBoundingClientRect();
    const drop = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    canvas.previewInner('group', { id: 'part', point: drop });
    await fixture.whenStable();
    expect(canvas.overTrash()).toBeTrue();
    expect(canvas.trash()!.nativeElement.disabled).toBeFalse();
    canvas.moveInner('group', { id: 'part', point: drop, drop });
    expect(game.board().nodes.find((n) => n.id === 'group')!.blocks).toEqual([]);
    expect(game.board().nodes.some((n) => n.id === 'part')).toBeFalse();
    game.undo();
    expect(game.board().nodes.find((n) => n.id === 'group')!.blocks!.length).toBe(1);
    fixture.destroy();
  });

  it('keeps Blocky available while a main connection is pending and cancels a shortcut without edits', async () => {
    const { fixture, game, canvas } = await setup();
    canvas.pending.set('pos');
    await fixture.whenStable();
    expect(canvas.helperSuppressed()).toBeFalse();
    expect(canvas.helperHint()).not.toBeNull();
    const before = JSON.stringify(game.board());
    const view = canvas.shortcutPlates().find((v) => v.from === 'pos')!;
    canvas.shortcutDrag.set({
      from: view.from,
      key: view.key,
      origin: view.origin,
      plate: { x: 1000, y: 500 },
      grab: { x: 0, y: 0 },
    });
    await fixture.whenStable();
    const plate = fixture.nativeElement.querySelector(
      '[aria-label^="Shortcut plate from pos"]',
    ) as HTMLElement;
    plate.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(canvas.shortcutDrag()).toBeNull();
    expect(JSON.stringify(game.board())).toBe(before);
    fixture.destroy();
  });
});
