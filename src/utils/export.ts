/** Exportação de tabelas em CSV, XLSX e PDF (bibliotecas carregadas sob demanda). */
export type ExportRow = Record<string, string | number | null | undefined>

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function slug(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

/** Escapa células para evitar injeção de fórmulas em planilhas (=, +, -, @). */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportCSV(name: string, rows: ExportRow[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [headers.map(csvCell).join(';'), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(';'))]
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${slug(name)}.csv`)
}

export async function exportXLSX(name: string, rows: ExportRow[]) {
  if (!rows.length) return
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31) || 'Dados')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${slug(name)}.xlsx`)
}

export async function exportPDF(title: string, rows: ExportRow[], subtitle?: string) {
  if (!rows.length) return
  const [{ jsPDF }, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const headers = Object.keys(rows[0])
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' })
  doc.setFontSize(14)
  doc.text(`AgroCentral — ${title}`, 14, 16)
  doc.setFontSize(9)
  doc.text(subtitle ?? `Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 22)
  autoTable.default(doc, {
    startY: 27,
    head: [headers],
    body: rows.map((r) => headers.map((h) => (r[h] ?? '') as string)),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [20, 83, 45] },
  })
  doc.save(`${slug(title)}.pdf`)
}

/** Pasta de trabalho com várias abas (ex.: orçamento MICRO / MACRO / RESUMO). */
export async function exportWorkbook(name: string, sheets: { name: string; rows: ExportRow[] }[]) {
  const usable = sheets.filter((s) => s.rows.length)
  if (!usable.length) return
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of usable) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows), s.name.slice(0, 31))
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${slug(name)}.xlsx`)
}

/** PDF com várias seções (título + tabela), em sequência. */
export async function exportPDFSections(title: string, sections: { title: string; rows: ExportRow[] }[], subtitle?: string) {
  const usable = sections.filter((s) => s.rows.length)
  if (!usable.length) return
  const [{ jsPDF }, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(`AgroCentral — ${title}`, 14, 16)
  doc.setFontSize(9)
  doc.text(subtitle ?? `Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 22)
  let y = 30
  for (const s of usable) {
    const headers = Object.keys(s.rows[0])
    if (y > 180) { doc.addPage(); y = 16 }
    doc.setFontSize(11)
    doc.text(s.title, 14, y)
    autoTable.default(doc, {
      startY: y + 3,
      head: [headers],
      body: s.rows.map((r) => headers.map((h) => (r[h] ?? '') as string)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 83, 45] },
    })
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10
  }
  doc.save(`${slug(title)}.pdf`)
}
