// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createLazyView } from '../../src/ui/lazyView';

describe('secciones cargadas bajo demanda', () => {
  it('comparte la carga en curso y no renderiza si se abandona la sección antes de terminar', async () => {
    const host = document.createElement('section');
    let visible = true;
    let resolve!: (view: { render(): void }) => void;
    const loaded = new Promise<{ render(): void }>((done) => {
      resolve = done;
    });
    const load = vi.fn(() => loaded);
    const render = vi.fn();
    const view = createLazyView(host, () => visible, load);
    view.render();
    expect(load).not.toHaveBeenCalled();
    const first = view.open();
    expect(view.open()).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Cargando');
    visible = false;
    resolve({ render });
    await first;
    expect(render).not.toHaveBeenCalled();
    visible = true;
    await view.open();
    view.render();
    expect(render).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(1);
    expect(host.querySelector<HTMLElement>('[role="status"]')?.hidden).toBe(true);
  });

  it('un fallo no vuelve a importar desde render y explica que la recuperación reinicia la simulación', async () => {
    const host = document.createElement('section');
    const render = vi.fn();
    const load = vi.fn<() => Promise<{ render(): void }>>().mockRejectedValue(new Error('red no disponible'));
    const view = createLazyView(host, () => true, load);
    await view.open();
    expect(host.textContent).toContain('No se pudo cargar');
    expect(host.textContent).toContain('reiniciará la simulación');
    expect(host.querySelector('button')?.hidden).toBe(false);
    view.render();
    await view.open();
    expect(load).toHaveBeenCalledTimes(1);
    expect(render).not.toHaveBeenCalled();
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    try {
      host.querySelector('button')?.click();
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
