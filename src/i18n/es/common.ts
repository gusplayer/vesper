/**
 * Words shared by several areas: the tabs, the buttons every sheet has. `back`, `close`,
 * `cancel`, `clear` and `dismiss` also feed the design system's own chrome (PageHeader,
 * Sheet, SearchField, Banner) through `ChromeProvider` in the root layout.
 */
export const common = {
  tabs: {
    focus: 'Focus',
    routines: 'Rutinas',
    activity: 'Actividad',
    settings: 'Ajustes',
  },
  cancel: 'Cancelar',
  save: 'Guardar',
  done: 'Listo',
  back: 'Volver',
  close: 'Cerrar',
  /** The x inside a search field. */
  clear: 'Borrar búsqueda',
  /** The x on a banner. */
  dismiss: 'Cerrar aviso',
  edit: 'Editar',
  continue: 'Continuar',
  none: 'Ninguno',
  /** The dash a value shows when there is nothing to show. */
  empty: '—',
};
