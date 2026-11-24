export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2a6840" />
      <path d="M16 25c0-6 0-9 0-13" stroke="#f3e7b5" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 15c-4.5 0-7-2.6-7-7 4.5 0 7 2.6 7 7Z" fill="#b9d9c0" />
      <path d="M16 19c4.5 0 7-2.6 7-7-4.5 0-7 2.6-7 7Z" fill="#d9b44a" />
      <path d="M8 25h16" stroke="#f3e7b5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      {!compact && <span className={dark ? 'text-[17px] font-semibold tracking-tight text-brand-900' : 'text-[17px] font-semibold tracking-tight text-white'}>AgroCentral</span>}
    </span>
  )
}
