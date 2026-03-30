const PHASES = [
  { n: 1, label: 'Background' },
  { n: 2, label: 'Deep Dive I' },
  { n: 3, label: 'Deep Dive II' },
  { n: 4, label: 'ML Q&A' },
  { n: 5, label: 'Behavioral' },
]

interface Props {
  currentPhase: number
}

export default function PhaseIndicator({ currentPhase }: Props) {
  return (
    <div data-testid="phase-indicator" className="flex items-center gap-1 px-4 py-2">
      {PHASES.map((p, i) => {
        const done = p.n < currentPhase
        const active = p.n === currentPhase
        return (
          <div key={p.n} className="flex items-center gap-1">
            <div className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all
              ${active ? 'bg-indigo-600 text-white' : done ? 'bg-slate-700 text-slate-400' : 'bg-slate-800/50 text-slate-600'}
            `}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px]
                ${active ? 'bg-white text-indigo-600' : done ? 'bg-slate-500 text-slate-200' : 'bg-slate-700 text-slate-500'}
              `}>
                {done ? '✓' : p.n}
              </span>
              <span className="hidden sm:inline">{p.label}</span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`w-4 h-px ${done ? 'bg-slate-600' : 'bg-slate-800'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
