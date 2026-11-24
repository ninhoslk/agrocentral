import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button, Checkbox, Input } from '@/components/ui/primitives'
import { Dropdown } from '@/components/ui/overlay'
import { EmptyState, ErrorState, LoadingRows } from '@/components/feedback/states'
import { exportCSV, exportPDF, exportXLSX, type ExportRow } from '@/utils/export'
import * as RPopover from '@radix-ui/react-popover'
import { useIsDesktop } from '@/hooks/useMediaQuery'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Valor para ordenação/busca/exportação */
  value?: (row: T) => string | number | null | undefined
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Oculto por padrão (pode ser ativado pelo usuário) */
  hidden?: boolean
  /** Coluna principal mostrada como título no modo cartão (celular) */
  primary?: boolean
}

export function DataTable<T extends object>({
  rows, columns, loading, error, onRetry, onRowClick, searchPlaceholder = 'Buscar…', toolbar, empty,
  exportName, pageSize = 20, initialSort, rowKey, dense,
}: {
  rows: T[] | undefined
  columns: Column<T>[]
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  onRowClick?: (row: T) => void
  searchPlaceholder?: string
  toolbar?: ReactNode
  empty?: ReactNode
  exportName?: string
  pageSize?: number
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  rowKey?: (row: T) => string
  dense?: boolean
}) {
  const desktop = useIsDesktop()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(0)
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(columns.map((c) => [c.key, !c.hidden])))

  const cols = columns.filter((c) => visible[c.key] !== false)
  const valueOf = (c: Column<T>, r: T) => {
    if (c.value) return c.value(r)
    const v = c.cell(r)
    return typeof v === 'string' || typeof v === 'number' ? v : null
  }

  const filtered = useMemo(() => {
    let data = rows ?? []
    if (q.trim()) {
      const needle = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      data = data.filter((r) =>
        columns.some((c) => {
          const v = valueOf(c, r)
          return v !== null && v !== undefined && String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(needle)
        }),
      )
    }
    if (sort) {
      const c = columns.find((x) => x.key === sort.key)
      if (c) {
        data = [...data].sort((a, b) => {
          const va = valueOf(c, a), vb = valueOf(c, b)
          if (va === vb) return 0
          if (va === null || va === undefined) return 1
          if (vb === null || vb === undefined) return -1
          const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true })
          return sort.dir === 'asc' ? cmp : -cmp
        })
      }
    }
    return data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages - 1)
  const pageRows = filtered.slice(current * pageSize, current * pageSize + pageSize)

  const exportRows = (): ExportRow[] =>
    filtered.map((r) => Object.fromEntries(cols.map((c) => [c.header, valueOf(c, r) ?? ''])))

  const toggleSort = (c: Column<T>) => {
    if (!c.sortable) return
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' }))
  }
  const keyOf = (r: T, i: number) => (rowKey ? rowKey(r) : String((r as { id?: string | number }).id ?? i))
  const primary = cols.find((c) => c.primary) ?? cols[0]

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder={searchPlaceholder} className="pl-9" aria-label="Buscar na tabela" />
        </div>
        {toolbar}
        <RPopover.Root>
          <RPopover.Trigger asChild>
            <Button variant="outline" size="sm" aria-label="Escolher colunas" className="hidden md:inline-flex"><Columns3 className="h-4 w-4" />Colunas</Button>
          </RPopover.Trigger>
          <RPopover.Portal>
            <RPopover.Content align="end" sideOffset={6} className="z-[1100] w-56 space-y-2 rounded-xl border border-line bg-white p-3 shadow-lg">
              {columns.map((c) => (
                <Checkbox key={c.key} label={c.header} checked={visible[c.key] !== false}
                  onChange={(e) => setVisible((v) => ({ ...v, [c.key]: e.target.checked }))} />
              ))}
            </RPopover.Content>
          </RPopover.Portal>
        </RPopover.Root>
        {exportName && (
          <Dropdown
            trigger={<Button variant="outline" size="sm" disabled={!filtered.length}><Download className="h-4 w-4" />Exportar</Button>}
            items={[
              { label: 'CSV', onSelect: () => exportCSV(exportName, exportRows()) },
              { label: 'Excel (XLSX)', onSelect: () => void exportXLSX(exportName, exportRows()) },
              { label: 'PDF', onSelect: () => void exportPDF(exportName, exportRows()) },
            ]}
          />
        )}
      </div>

      {loading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !filtered.length ? (
        q ? <EmptyState title="Nenhum resultado" description={`Nada encontrado para “${q}”.`} /> : (empty ?? <EmptyState title="Nenhum registro" />)
      ) : (
        <>
          {/* Desktop/tablet: tabela — no celular, lista de cartões (renderiza só um dos dois) */}
          {desktop ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/70 text-left text-xs font-medium text-muted">
                <tr>
                  {cols.map((c) => (
                    <th key={c.key} scope="col" className={cn('whitespace-nowrap px-4 py-2.5', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}
                      aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                      {c.sortable ? (
                        <button type="button" onClick={() => toggleSort(c)} className="inline-flex items-center gap-1 hover:text-ink">
                          {c.header}
                          {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </button>
                      ) : c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageRows.map((r, i) => (
                  <tr key={keyOf(r, i)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                    className={cn(onRowClick && 'cursor-pointer hover:bg-brand-50/40')}>
                    {cols.map((c) => (
                      <td key={c.key} className={cn('px-4', dense ? 'py-1.5' : 'py-2.5', c.align === 'right' && 'text-right tabular', c.align === 'center' && 'text-center', c.className)}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : (
          <ul className="divide-y divide-line">
            {pageRows.map((r, i) => (
              <li key={keyOf(r, i)}>
                <div role={onRowClick ? 'button' : undefined} tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r) } : undefined}
                  className={cn('block min-h-[56px] w-full space-y-1.5 px-4 py-3.5 text-left', onRowClick && 'cursor-pointer active:bg-brand-50/60')}>
                  <div className="font-medium">{primary.cell(r)}</div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
                    {cols.filter((c) => c !== primary && c.header).slice(0, 6).map((c) => (
                      <div key={c.key} className="min-w-0">
                        <dt className="text-muted">{c.header}</dt>
                        <dd className="truncate">{c.cell(r)}</dd>
                      </div>
                    ))}
                  </dl>
                  {cols.some((c) => !c.header) && (
                    <div className="-mx-2 flex flex-wrap justify-end gap-1 pt-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      {cols.filter((c) => !c.header).map((c) => <div key={c.key}>{c.cell(r)}</div>)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
              <span>{filtered.length} registros · página {current + 1} de {pages}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Próxima página" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
          {pages <= 1 && <div className="border-t border-line px-4 py-2 text-xs text-muted">{filtered.length} registro(s)</div>}
        </>
      )}
    </div>
  )
}
