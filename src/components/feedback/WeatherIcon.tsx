import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Ícone vetorial para o código WMO do tempo (sem emoji; cor neutra, chuva em azul). */
export function WeatherIcon({ code, isDay = 1, className }: { code: number | null | undefined; isDay?: number; className?: string }) {
  const c = code ?? -1
  const props = { className: cn('h-5 w-5 shrink-0', className), 'aria-hidden': true, strokeWidth: 1.75 }
  if (c === 0) return isDay ? <Sun {...props} className={cn(props.className, 'text-amber-500')} /> : <Moon {...props} />
  if (c >= 1 && c <= 2) return <CloudSun {...props} className={cn(props.className, 'text-slate-500')} />
  if (c === 3) return <Cloud {...props} className={cn(props.className, 'text-slate-500')} />
  if (c === 45 || c === 48) return <CloudFog {...props} className={cn(props.className, 'text-slate-500')} />
  if (c >= 51 && c <= 57) return <CloudDrizzle {...props} className={cn(props.className, 'text-sky-600')} />
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return <CloudRain {...props} className={cn(props.className, 'text-sky-600')} />
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return <CloudSnow {...props} className={cn(props.className, 'text-sky-500')} />
  if (c >= 95) return <CloudLightning {...props} className={cn(props.className, 'text-sky-700')} />
  return <Cloud {...props} className={cn(props.className, 'text-slate-400')} />
}
