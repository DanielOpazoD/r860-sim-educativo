import { describe, expect, it } from 'vitest';
import { filterCommands, normalize, type PaletteCommand } from '../../src/ui/commandPalette';

const command = (label: string, keywords = '', group: PaletteCommand['group'] = 'Acciones'): PaletteCommand => ({
  id: label,
  group,
  label,
  keywords,
  run: () => {},
});

describe('Paleta de comandos', () => {
  it('normaliza mayúsculas y diacríticos', () => {
    expect(normalize('Pulmón RÍGIDO')).toBe('pulmon rigido');
  });

  it('devuelve todos los comandos en el orden original con la consulta vacía', () => {
    const list = [command('Congelar curvas'), command('Pausar o reanudar'), command('Curvas y datos', '', 'Vistas')];
    expect(filterCommands(list, '')).toEqual(list);
  });

  it('encuentra texto con diacríticos ignorados', () => {
    const profile = command('Perfil: Pulmón rígido', '', 'Perfiles');
    expect(filterCommands([profile], 'pulmon')).toEqual([profile]);
  });

  it('requiere que coincidan todos los tokens', () => {
    const inspiratory = command('Bloqueo inspiratorio');
    const expiratory = command('Bloqueo espiratorio');
    expect(filterCommands([inspiratory, expiratory], 'bloqueo esp')).toEqual([expiratory]);
  });

  it('prioriza coincidencias de prefijo y conserva el orden dentro de cada bloque', () => {
    const list = [command('Exportar tabla'), command('Tabla de mediciones', '', 'Vistas')];
    expect(filterCommands(list, 'tabla')).toEqual([list[1], list[0]]);
  });

  it('incluye las palabras clave en la búsqueda', () => {
    const expiratory = command('Bloqueo espiratorio', 'autopeep peep intrinseca');
    expect(filterCommands([expiratory], 'autopeep')).toEqual([expiratory]);
  });

  it('no devuelve elementos sin coincidencia', () => {
    expect(filterCommands([command('Sesión y archivos')], 'zzzz')).toEqual([]);
  });
});
