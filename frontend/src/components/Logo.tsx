import logoSvg from '../assets/vishnuai-logo.svg'

interface Props {
  size?: number
  showWordmark?: boolean
  className?: string
}

export default function Logo({ size = 40, showWordmark = true, className = '' }: Props) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={logoSvg}
        width={size}
        height={size}
        alt="VishnuAI Labs"
        className="flex-shrink-0"
      />
      {showWordmark && (
        <div className="leading-tight">
          <span className="text-white font-semibold tracking-tight" style={{ fontSize: size * 0.38 }}>
            Vishnu
            <span className="text-indigo-400">AI</span>
          </span>
          <span
            className="block text-slate-500 font-medium tracking-widest uppercase"
            style={{ fontSize: size * 0.2 }}
          >
            Labs
          </span>
        </div>
      )}
    </div>
  )
}
