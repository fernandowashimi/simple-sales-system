import { CalendarDate, parseDate } from '@internationalized/date'

// pt-BR copy for BoardUI components' built-in strings (fed to TemplateCopyProvider).
const PT: Record<string, string> = {
  Cancel: 'Cancelar',
  Apply: 'Aplicar',
  Confirm: 'Confirmar',
  Close: 'Fechar',
  'No results': 'Nenhum resultado',
  'Start date': 'Data inicial',
  'End date': 'Data final',
  'Select date range': 'Selecionar período',
  'Select date': 'Selecionar data',
  'Date range': 'Período',
  Date: 'Data',
  Today: 'Hoje',
  Yesterday: 'Ontem',
  'Last week': 'Última semana',
  'Last month': 'Último mês',
  'Last year': 'Último ano',
  'This month': 'Este mês',
  'This year': 'Este ano',
  'All time': 'Todo o período',
  'Dismiss notification': 'Dispensar notificação'
}

export function translate(text: string): string {
  const days = /^(\d+) days? selected$/.exec(text)
  if (days) return `${days[1]} dia${days[1] === '1' ? '' : 's'} selecionado${days[1] === '1' ? '' : 's'}`
  return PT[text] ?? text
}

export const isoToCalendar = (iso: string | null): CalendarDate | null => (iso ? parseDate(iso) : null)
export const calendarToIso = (d: CalendarDate | null): string | null => (d ? d.toString() : null)
