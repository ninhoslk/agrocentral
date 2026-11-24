import { useMemo, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { useCurrentOrg } from '@/app/providers/OrgProvider'
import { PageHeader } from '@/components/ui/layout'
import { Card, CardHeader, FieldWrap, Input, Select } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'
import { formatBRL, formatNumber } from '@/lib/format'
import { AREA_UNITS, convertArea, convertWeight, type AreaUnit, type WeightUnit } from '@/lib/units'
import * as C from '@/lib/calculators'
import { useLookups } from '@/hooks/useLookups'

type Calc = 'custo_ha' | 'custo_saca' | 'produtividade' | 'lucro' | 'equilibrio' | 'area' | 'peso' | 'sementes' | 'adubacao' | 'pulverizacao' | 'combustivel' | 'irrigacao' | 'financiamento'
const LIST: { id: Calc; label: string }[] = [
  { id: 'custo_ha', label: 'Custo por hectare' }, { id: 'custo_saca', label: 'Custo por saca' }, { id: 'produtividade', label: 'Produtividade' },
  { id: 'lucro', label: 'Lucro e rentabilidade' }, { id: 'equilibrio', label: 'Ponto de equilíbrio' }, { id: 'area', label: 'Conversão de área' },
  { id: 'peso', label: 'Conversão de peso' }, { id: 'sementes', label: 'Sementes' }, { id: 'adubacao', label: 'Adubação' },
  { id: 'pulverizacao', label: 'Pulverização (calda)' }, { id: 'combustivel', label: 'Combustível' }, { id: 'irrigacao', label: 'Irrigação' },
  { id: 'financiamento', label: 'Financiamento' },
]

const parse = (s: string) => { const n = Number(s.replace(/\./g, '').replace(',', '.')); return s.trim() === '' || !Number.isFinite(n) ? NaN : n }

function useNums<T extends Record<string, string>>(init: T) {
  const [v, setV] = useState(init)
  const n = useMemo(() => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, parse(x)])) as Record<keyof T, number>, [v])
  const bind = (k: keyof T, label: string, suffix?: string, hint?: string) => (
    <FieldWrap key={String(k)} label={label} htmlFor={`c-${String(k)}`} hint={hint}>
      <div className="relative">
        <Input id={`c-${String(k)}`} inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={suffix ? 'pr-16' : ''} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
      </div>
    </FieldWrap>
  )
  return { n, bind, set: setV, v }
}

const Result = ({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0">
    <span className="text-sm text-muted">{label}</span>
    <span className={cn('tabular', strong ? 'text-lg font-semibold text-brand-900' : 'font-medium')}>{value}</span>
  </div>
)
const ok = (x: number) => Number.isFinite(x)
const show = (x: number | undefined, f: (n: number) => string) => (x !== undefined && ok(x) ? f(x) : '—')

function Frame({ formula, premises, inputs, results }: { formula: ReactNode; premises: ReactNode; inputs: ReactNode; results: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader title="Dados de entrada" /><div className="grid gap-4 p-5 sm:grid-cols-2">{inputs}</div></Card>
      <div className="space-y-4">
        <Card><CardHeader title="Resultado" /><div className="px-5 py-2">{results}</div></Card>
        <Card className="bg-surface">
          <div className="space-y-2 p-4 text-xs text-muted">
            <p><strong className="text-ink">Fórmula:</strong> {formula}</p>
            <p><strong className="text-ink">Premissas e limites:</strong> {premises}</p>
            <p className="flex items-start gap-1"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Resultado de apoio à decisão. Não substitui recomendação de engenheiro agrônomo ou responsável técnico.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

export function CalculatorsPage() {
  const [calc, setCalc] = useState<Calc>('custo_ha')
  const { farm } = useCurrentOrg()
  const { fields } = useLookups()
  const importedArea = farm?.total_area_ha ?? null

  return (
    <>
      <PageHeader title="Calculadoras agrícolas" crumbs={[{ label: 'Gestão' }, { label: 'Calculadoras' }]}
        description="Cada calculadora mostra fórmula, unidades e premissas. Áreas podem ser importadas dos talhões cadastrados." />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Calculadoras" className="card h-fit p-2">
          <Select aria-label="Calculadora" className="mb-2 lg:hidden" value={calc} onChange={(e) => setCalc(e.target.value as Calc)}>{LIST.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
          <ul className="hidden lg:block">
            {LIST.map((c) => (
              <li key={c.id}><button type="button" onClick={() => setCalc(c.id)} className={cn('w-full rounded-lg px-3 py-2 text-left text-sm', calc === c.id ? 'bg-brand-50 font-medium text-brand-900' : 'hover:bg-surface')}>{c.label}</button></li>
            ))}
          </ul>
        </nav>
        <div>
          <AreaImport fields={fields.data ?? []} farmArea={importedArea} />
          <div className="mt-4">
            {calc === 'custo_ha' && <CostHa />}
            {calc === 'custo_saca' && <CostSack />}
            {calc === 'produtividade' && <Productivity />}
            {calc === 'lucro' && <Profit />}
            {calc === 'equilibrio' && <BreakEven />}
            {calc === 'area' && <AreaConv />}
            {calc === 'peso' && <WeightConv />}
            {calc === 'sementes' && <Seeds />}
            {calc === 'adubacao' && <Fert />}
            {calc === 'pulverizacao' && <Spray />}
            {calc === 'combustivel' && <FuelCalc />}
            {calc === 'irrigacao' && <Irrig />}
            {calc === 'financiamento' && <Financing />}
          </div>
        </div>
      </div>
    </>
  )
}

function AreaImport({ fields, farmArea }: { fields: { id: string; name: string; area_ha: number | null; manual_area_ha: number | null }[]; farmArea: number | null }) {
  const [sel, setSel] = useState('')
  const area = sel === 'farm' ? farmArea : fields.find((f) => f.id === sel)?.area_ha ?? fields.find((f) => f.id === sel)?.manual_area_ha
  return (
    <div className="card flex flex-wrap items-end gap-3 p-3 text-sm">
      <FieldWrap label="Consultar área cadastrada" htmlFor="imp-area">
        <Select id="imp-area" value={sel} onChange={(e) => setSel(e.target.value)} className="w-64">
          <option value="">—</option>
          {farmArea ? <option value="farm">Propriedade selecionada</option> : null}
          {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Select>
      </FieldWrap>
      {area ? <span className="pb-2">Área: <strong className="tabular">{formatNumber(area, 2)} ha</strong> <button type="button" className="ml-2 text-brand-700 underline" onClick={() => navigator.clipboard?.writeText(String(area).replace('.', ','))}>copiar</button></span> : <span className="pb-2 text-xs text-muted">Selecione para ver e copiar a área (ha).</span>}
    </div>
  )
}

function CostHa() {
  const { n, bind } = useNums({ cost: '', area: '' })
  return <Frame formula="Custo/ha = custo total (R$) ÷ área (ha)" premises="Inclua todos os custos do período/safra considerados. Área em hectares."
    inputs={<>{bind('cost', 'Custo total', 'R$')}{bind('area', 'Área', 'ha')}</>}
    results={<Result strong label="Custo por hectare" value={show(C.costPerHectare(n.cost, n.area), formatBRL)} />} />
}
function CostSack() {
  const { n, bind } = useNums({ cost: '', prod: '', area: '' })
  const sacks = n.prod
  return <Frame formula="Custo/saca = custo total ÷ produção (sacas)" premises="A produção deve estar em sacas do mesmo peso usado na comercialização."
    inputs={<>{bind('cost', 'Custo total', 'R$')}{bind('prod', 'Produção', 'sc')}{bind('area', 'Área (opcional)', 'ha')}</>}
    results={<><Result strong label="Custo por saca" value={show(C.costPerSack(n.cost, sacks), formatBRL)} /><Result label="Produtividade" value={show(sacks / n.area, (x) => `${formatNumber(x, 1)} sc/ha`)} /></>} />
}
function Productivity() {
  const { n, bind, v, set } = useNums({ prod: '', area: '', sack: '60' })
  const [unit, setUnit] = useState<WeightUnit>('kg')
  let sacks = NaN
  try { sacks = convertWeight(n.prod, unit, 'sc', n.sack) } catch { /* sem peso da saca */ }
  return <Frame formula="Produtividade = produção ÷ área; sacas = kg ÷ peso da saca" premises="O peso da saca depende do produto (soja/milho 60 kg; arroz 50 kg). Não é presumido."
    inputs={<>{bind('prod', 'Produção')}
      <FieldWrap label="Unidade da produção" htmlFor="u"><Select id="u" value={unit} onChange={(e) => setUnit(e.target.value as WeightUnit)}><option value="kg">kg</option><option value="t">t</option><option value="sc">sc</option><option value="@">@ (15 kg)</option></Select></FieldWrap>
      {bind('area', 'Área', 'ha')}{bind('sack', 'Peso da saca', 'kg')}
      <p className="text-xs text-muted sm:col-span-2">{v.sack ? '' : 'Informe o peso da saca.'}<button type="button" className="underline" onClick={() => set({ ...v, sack: '60' })}>60 kg</button> · <button type="button" className="underline" onClick={() => set({ ...v, sack: '50' })}>50 kg</button></p></>}
    results={<><Result strong label="Produtividade" value={show(sacks / n.area, (x) => `${formatNumber(x, 2)} sc/ha`)} /><Result label="Em kg/ha" value={show(convertWeight(n.prod || 0, unit === 'sc' ? 'kg' : unit, 'kg') / n.area * (unit === 'sc' ? n.sack : 1), (x) => `${formatNumber(x, 0)} kg/ha`)} /><Result label="Produção em sacas" value={show(sacks, (x) => formatNumber(x, 1))} /></>} />
}
function Profit() {
  const { n, bind } = useNums({ rev: '', cost: '' })
  const r = C.profitability(n.rev, n.cost)
  return <Frame formula="Lucro = receita − custo; margem = lucro ÷ receita; retorno = lucro ÷ custo" premises="Valores do mesmo período/safra."
    inputs={<>{bind('rev', 'Receita', 'R$')}{bind('cost', 'Custo total', 'R$')}</>}
    results={<><Result strong label="Lucro" value={show(r.profit, formatBRL)} /><Result label="Margem" value={show(r.marginPct, (x) => `${formatNumber(x, 1)}%`)} /><Result label="Retorno sobre o custo" value={show(r.roiPct, (x) => `${formatNumber(x, 1)}%`)} /></>} />
}
function BreakEven() {
  const { n, bind } = useNums({ cost: '', prod: '', price: '' })
  const r = C.breakEven(n.cost, n.prod, n.price)
  return <Frame formula="Preço mínimo = custo ÷ produção; produção mínima = custo ÷ preço" premises="Considera custo total fixo para a safra; não inclui impostos/fretes não informados."
    inputs={<>{bind('cost', 'Custo total', 'R$')}{bind('prod', 'Produção esperada', 'sc')}{bind('price', 'Preço de venda', 'R$/sc')}</>}
    results={<><Result strong label="Preço mínimo para empatar" value={show(r.minPrice, (x) => `${formatBRL(x)}/sc`)} /><Result label="Produção mínima ao preço informado" value={show(r.minProduction, (x) => `${formatNumber(x, 0)} sc`)} /></>} />
}
function AreaConv() {
  const { n, bind } = useNums({ v: '' })
  const [from, setFrom] = useState<AreaUnit>('ha')
  return <Frame formula="valor × fator de origem ÷ fator de destino (base: hectare)" premises="Alqueire varia por região: paulista 2,42 ha; mineiro/goiano 4,84 ha; baiano 9,68 ha."
    inputs={<>{bind('v', 'Valor')}<FieldWrap label="Unidade" htmlFor="af"><Select id="af" value={from} onChange={(e) => setFrom(e.target.value as AreaUnit)}>{Object.entries(AREA_UNITS).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}</Select></FieldWrap></>}
    results={<>{(Object.keys(AREA_UNITS) as AreaUnit[]).filter((u) => u !== from).map((u) => <Result key={u} label={AREA_UNITS[u].label} value={show(convertArea(n.v, from, u), (x) => formatNumber(x, 4))} />)}</>} />
}
function WeightConv() {
  const { n, bind } = useNums({ v: '', sack: '60' })
  const [from, setFrom] = useState<WeightUnit>('kg')
  const conv = (to: WeightUnit) => { try { return convertWeight(n.v, from, to, n.sack) } catch { return NaN } }
  return <Frame formula="Conversão via kg; @ = 15 kg; saca = peso configurado" premises="Peso da saca deve ser informado (varia por produto)."
    inputs={<>{bind('v', 'Valor')}<FieldWrap label="Unidade" htmlFor="wf"><Select id="wf" value={from} onChange={(e) => setFrom(e.target.value as WeightUnit)}><option value="kg">kg</option><option value="t">t</option><option value="sc">sc</option><option value="@">@</option></Select></FieldWrap>{bind('sack', 'Peso da saca', 'kg')}</>}
    results={<>{(['kg', 't', 'sc', '@'] as WeightUnit[]).filter((u) => u !== from).map((u) => <Result key={u} label={u} value={show(conv(u), (x) => formatNumber(x, 3))} />)}</>} />
}
function Seeds() {
  const { n, bind } = useNums({ pop: '300000', germ: '90', emerg: '90', spacing: '0,5', tsw: '180', area: '' })
  const r = C.seeds({ population: n.pop, germinationPct: n.germ, emergencePct: n.emerg, rowSpacingM: n.spacing, tsw: n.tsw, areaHa: n.area })
  return <Frame formula="Sementes/ha = população ÷ (germinação × emergência); sementes/m = sementes/ha ÷ (10.000 ÷ espaçamento); kg/ha = sementes/ha × PMS ÷ 10⁶" premises="Use germinação e vigor do lote (laudo). PMS = peso de mil sementes (g)."
    inputs={<>{bind('pop', 'População desejada', 'pl/ha')}{bind('germ', 'Germinação', '%')}{bind('emerg', 'Emergência a campo', '%')}{bind('spacing', 'Espaçamento', 'm')}{bind('tsw', 'PMS', 'g')}{bind('area', 'Área', 'ha')}</>}
    results={<><Result strong label="Sementes por metro" value={show(r.seedsPerMeter, (x) => formatNumber(x, 1))} /><Result label="Sementes por hectare" value={show(r.seedsPerHa, (x) => formatNumber(x, 0))} /><Result label="kg por hectare" value={show(r.kgPerHa, (x) => formatNumber(x, 1))} /><Result label="Total para a área" value={show(r.totalKg, (x) => `${formatNumber(x, 0)} kg`)} /></>} />
}
function Fert() {
  const { n, bind } = useNums({ dose: '', conc: '', area: '', price: '' })
  const r = C.fertilizer({ nutrientDoseKgHa: n.dose, productConcentrationPct: n.conc, areaHa: n.area, pricePerTon: ok(n.price) ? n.price : undefined })
  return <Frame formula="Produto (kg/ha) = dose do nutriente (kg/ha) ÷ concentração (%)" premises="Dose conforme recomendação técnica baseada em análise de solo. Ex.: MAP 52% de P₂O₅."
    inputs={<>{bind('dose', 'Dose do nutriente', 'kg/ha')}{bind('conc', 'Concentração no produto', '%')}{bind('area', 'Área', 'ha')}{bind('price', 'Preço do produto (opcional)', 'R$/t')}</>}
    results={<><Result strong label="Produto por hectare" value={show(r.productKgHa, (x) => `${formatNumber(x, 1)} kg/ha`)} /><Result label="Total" value={show(r.totalKg, (x) => `${formatNumber(x, 0)} kg`)} /><Result label="Custo estimado" value={show(r.totalCost, formatBRL)} /></>} />
}
function Spray() {
  const { n, bind } = useNums({ vol: '100', tank: '', dose: '', area: '' })
  const r = C.spraying({ sprayVolumeLHa: n.vol, tankCapacityL: n.tank, doseHa: n.dose, areaHa: n.area })
  return <Frame formula="Área por tanque = capacidade ÷ volume de calda; produto por tanque = área por tanque × dose/ha" premises="Dose conforme rótulo/receituário agronômico. Calibre o pulverizador antes."
    inputs={<>{bind('vol', 'Volume de calda', 'L/ha')}{bind('tank', 'Capacidade do tanque', 'L')}{bind('dose', 'Dose do produto', 'L ou kg/ha')}{bind('area', 'Área', 'ha')}</>}
    results={<><Result strong label="Produto por tanque" value={show(r.productPerTank, (x) => formatNumber(x, 2))} /><Result label="Área por tanque" value={show(r.areaPerTank, (x) => `${formatNumber(x, 2)} ha`)} /><Result label="Nº de tanques" value={show(r.tanks, (x) => formatNumber(x, 1))} /><Result label="Produto total" value={show(r.totalProduct, (x) => formatNumber(x, 2))} /></>} />
}
function FuelCalc() {
  const { n, bind } = useNums({ cons: '', hours: '', price: '', haH: '' })
  const r = C.fuel({ consumptionLH: n.cons, hours: n.hours, pricePerL: n.price, haPerHour: ok(n.haH) ? n.haH : undefined })
  return <Frame formula="Litros = consumo (L/h) × horas; custo = litros × preço" premises="Consumo médio da máquina na operação; rendimento operacional opcional para valores por hectare."
    inputs={<>{bind('cons', 'Consumo', 'L/h')}{bind('hours', 'Horas', 'h')}{bind('price', 'Preço do combustível', 'R$/L')}{bind('haH', 'Rendimento (opcional)', 'ha/h')}</>}
    results={<><Result strong label="Custo total" value={show(r.cost, formatBRL)} /><Result label="Litros" value={show(r.liters, (x) => `${formatNumber(x, 0)} L`)} /><Result label="L/ha" value={show(r.litersPerHa, (x) => formatNumber(x, 2))} /><Result label="R$/ha" value={show(r.costPerHa, formatBRL)} /></>} />
}
function Irrig() {
  const { n, bind } = useNums({ eto: '', kc: '1', eff: '85', area: '', days: '7' })
  const r = C.irrigation({ etoMmDay: n.eto, kc: n.kc, efficiencyPct: n.eff, areaHa: n.area, days: n.days })
  return <Frame formula="ETc = ETo × Kc; lâmina bruta = ETc ÷ eficiência; 1 mm em 1 ha = 10 m³" premises="ETo pode ser obtida na página de Clima (ET₀ diária). Kc depende da cultura e do estágio."
    inputs={<>{bind('eto', 'ETo', 'mm/dia')}{bind('kc', 'Kc da cultura')}{bind('eff', 'Eficiência do sistema', '%')}{bind('area', 'Área', 'ha')}{bind('days', 'Período', 'dias')}</>}
    results={<><Result strong label="Volume por dia" value={show(r.m3PerDay, (x) => `${formatNumber(x, 0)} m³`)} /><Result label="ETc" value={show(r.etc, (x) => `${formatNumber(x, 2)} mm/dia`)} /><Result label="Lâmina bruta" value={show(r.grossMmDay, (x) => `${formatNumber(x, 2)} mm/dia`)} /><Result label="Volume no período" value={show(r.m3Total, (x) => `${formatNumber(x, 0)} m³`)} /></>} />
}
function Financing() {
  const { n, bind } = useNums({ p: '', rate: '', n: '12' })
  const [sys, setSys] = useState<'price' | 'sac'>('price')
  const r = ok(n.p) && ok(n.rate) && ok(n.n) && n.n > 0 && n.n <= 480 ? C.financing({ principal: n.p, ratePct: n.rate, periods: Math.round(n.n), system: sys }) : null
  return <Frame formula={sys === 'price' ? 'Price: PMT = P × i ÷ (1 − (1+i)^−n)' : 'SAC: amortização = P ÷ n; parcela = amortização + juros sobre saldo'} premises="Taxa ao período (ex.: mensal). Não inclui IOF, TAC ou seguros."
    inputs={<>{bind('p', 'Valor financiado', 'R$')}{bind('rate', 'Taxa por período', '%')}{bind('n', 'Nº de parcelas')}
      <FieldWrap label="Sistema" htmlFor="sys"><Select id="sys" value={sys} onChange={(e) => setSys(e.target.value as 'price' | 'sac')}><option value="price">Price (parcelas fixas)</option><option value="sac">SAC (amortização constante)</option></Select></FieldWrap></>}
    results={r ? <><Result strong label={sys === 'price' ? 'Parcela' : '1ª parcela'} value={formatBRL(r.rows[0].payment)} /><Result label="Última parcela" value={formatBRL(r.rows.at(-1)!.payment)} /><Result label="Total pago" value={formatBRL(r.total)} /><Result label="Juros totais" value={formatBRL(r.totalInterest)} /></> : <p className="py-3 text-sm text-muted">Preencha os campos.</p>} />
}
