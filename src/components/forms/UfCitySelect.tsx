import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { FieldWrap, Input, Select } from '@/components/ui/primitives'
import { fetchMunicipios, UFS } from '@/services/providers/ibge'

/** Seleção de UF + município (lista oficial do IBGE; se o serviço falhar, permite digitar). */
export function UfCitySelect({ uf, city, onUf, onCity, required, errors }: {
  uf: string; city: string; onUf: (v: string) => void; onCity: (v: string) => void; required?: boolean
  errors?: { uf?: string; city?: string }
}) {
  const id = useId()
  const mun = useQuery({ queryKey: ['ibge-mun', uf], enabled: !!uf, staleTime: Infinity, queryFn: () => fetchMunicipios(uf), retry: 1 })
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <FieldWrap label="UF" htmlFor={`${id}-uf`} required={required} error={errors?.uf}>
        <Select id={`${id}-uf`} value={uf} onChange={(e) => { onUf(e.target.value); onCity('') }}>
          <option value="">—</option>
          {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
        </Select>
      </FieldWrap>
      <FieldWrap label="Município" htmlFor={`${id}-city`} required={required} error={errors?.city}
        hint={mun.isError ? 'Lista do IBGE indisponível no momento — digite o nome.' : undefined}>
        {mun.isError || !uf ? (
          <Input id={`${id}-city`} value={city} onChange={(e) => onCity(e.target.value)} disabled={!uf && !mun.isError} placeholder={uf ? '' : 'Escolha a UF'} />
        ) : (
          <Select id={`${id}-city`} value={city} onChange={(e) => onCity(e.target.value)} disabled={mun.isLoading}>
            <option value="">{mun.isLoading ? 'Carregando…' : 'Selecione…'}</option>
            {mun.data?.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        )}
      </FieldWrap>
    </div>
  )
}
