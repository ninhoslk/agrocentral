/**
 * Adaptador IBGE (API de Localidades — dados públicos oficiais) para UF/município.
 * https://servicodados.ibge.gov.br/api/docs/localidades
 */
export const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const

const memory = new Map<string, string[]>()

export async function fetchMunicipios(uf: string): Promise<string[]> {
  if (!uf) return []
  if (memory.has(uf)) return memory.get(uf)!
  const key = `ibge.mun.${uf}`
  try {
    const cached = sessionStorage.getItem(key)
    if (cached) { const v = JSON.parse(cached) as string[]; memory.set(uf, v); return v }
  } catch { /* armazenamento indisponível */ }
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
  if (!res.ok) throw new Error('IBGE indisponível')
  const data = (await res.json()) as { nome: string }[]
  const names = data.map((m) => m.nome)
  memory.set(uf, names)
  try { sessionStorage.setItem(key, JSON.stringify(names)) } catch { /* */ }
  return names
}
