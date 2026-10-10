export type PaletteCommand = {
  id: string;
  group: 'Acciones' | 'Vistas' | 'Escenarios' | 'Perfiles';
  label: string;
  keywords?: string;
  shortcut?: string;
  run: () => void | Promise<void>;
};

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function filterCommands(list: PaletteCommand[], query: string): PaletteCommand[] {
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [...list];
  const first = tokens[0] as string;
  return list
    .map((command, index) => ({ command, index, prefix: normalize(command.label).startsWith(first) }))
    .filter(({ command }) => {
      const haystack = normalize(`${command.label} ${command.keywords ?? ''} ${command.group}`);
      return tokens.every((token) => haystack.includes(token));
    })
    .sort((a, b) => Number(b.prefix) - Number(a.prefix) || a.index - b.index)
    .map(({ command }) => command);
}

export interface CommandPalette {
  open(): void;
  close(): void;
  toggle(): void;
  readonly isOpen: boolean;
}

export function createCommandPalette(commands: () => PaletteCommand[]): CommandPalette {
  const dialogElement = document.querySelector<HTMLDialogElement>('#command-palette');
  const inputElement = document.querySelector<HTMLInputElement>('#palette-input');
  const listElement = document.querySelector<HTMLUListElement>('#palette-list');
  if (!dialogElement || !inputElement || !listElement) throw new Error('Falta el contenedor de la paleta de comandos.');
  const dialog: HTMLDialogElement = dialogElement;
  const input: HTMLInputElement = inputElement;
  const list: HTMLUListElement = listElement;

  let filtered: PaletteCommand[] = [];
  let selectedIndex = 0;
  let returnFocus: HTMLElement | null = null;

  function restoreFocus(): void {
    const target = returnFocus;
    returnFocus = null;
    if (target?.isConnected) target.focus();
  }

  function setActiveOption(): void {
    const options = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
    for (let i = 0; i < options.length; i++) options[i]?.setAttribute('aria-selected', String(i === selectedIndex));
    const active = options[selectedIndex];
    if (active) {
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function render(): void {
    filtered = filterCommands(commands(), input.value);
    selectedIndex = 0;
    list.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('li');
      empty.className = 'palette-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = 'Sin resultados';
      list.append(empty);
      setActiveOption();
      return;
    }

    let group = '';
    for (let i = 0; i < filtered.length; i++) {
      const command = filtered[i] as PaletteCommand;
      if (command.group !== group) {
        group = command.group;
        const heading = document.createElement('li');
        heading.className = 'palette-group';
        heading.setAttribute('role', 'presentation');
        heading.textContent = group;
        list.append(heading);
      }

      const option = document.createElement('li');
      option.id = `palette-opt-${i}`;
      option.dataset.index = String(i);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(i === selectedIndex));
      const label = document.createElement('span');
      label.className = 'palette-option-label';
      label.textContent = command.label;
      option.append(label);
      if (command.shortcut) {
        const shortcut = document.createElement('kbd');
        shortcut.textContent = command.shortcut;
        option.append(shortcut);
      }
      list.append(option);
    }
    setActiveOption();
  }

  function close(): void {
    if (dialog.open) dialog.close();
    restoreFocus();
  }

  function runSelected(): void {
    const command = filtered[selectedIndex];
    if (!command) return;
    close();
    void command.run();
  }

  function moveSelection(delta: number): void {
    if (!filtered.length) return;
    selectedIndex = (selectedIndex + delta + filtered.length) % filtered.length;
    setActiveOption();
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runSelected();
    }
  });
  list.addEventListener('click', (event) => {
    const option = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
    if (!option) return;
    selectedIndex = Number(option.dataset.index);
    runSelected();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', restoreFocus);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  return {
    open() {
      if (dialog.open) return;
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      input.value = '';
      render();
      dialog.showModal();
      input.focus();
    },
    close,
    toggle() {
      if (dialog.open) close();
      else this.open();
    },
    get isOpen() {
      return dialog.open;
    },
  };
}
