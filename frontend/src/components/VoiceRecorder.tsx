import { useCallback } from 'react'

interface Props {
  isRecording: boolean
  isLoading: boolean
  disabled: boolean
  audioLevel: number   // 0–100 live mic level
  onStartRecording: () => void
  onStopRecording: () => void
}

export default function VoiceRecorder({ isRecording, isLoading, disabled, audioLevel, onStartRecording, onStopRecording }: Props) {
  const handleMouseDown = useCallback(() => {
    if (!disabled && !isLoading) onStartRecording()
  }, [disabled, isLoading, onStartRecording])

  const handleMouseUp = useCallback(() => {
    if (isRecording) onStopRecording()
  }, [isRecording, onStopRecording])

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (!disabled && !isLoading) onStartRecording()
  }, [disabled, isLoading, onStartRecording])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (isRecording) onStopRecording()
  }, [isRecording, onStopRecording])

  return (
    <button
      data-testid="voice-recorder-btn"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      disabled={disabled || isLoading}
      className={`
        relative w-14 h-14 rounded-full flex items-center justify-center transition-all select-none
        ${isRecording
          ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/40'
          : disabled || isLoading
            ? 'bg-slate-700 cursor-not-allowed opacity-50'
            : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 cursor-pointer'
        }
      `}
      title={isRecording ? 'Release to send' : 'Hold to speak'}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : isRecording ? (
        <div className="flex gap-0.5 items-end h-5">
          {[0.6, 1.0, 0.8, 0.5].map((scale, i) => {
            const pct = Math.max(4, Math.min(20, (audioLevel / 255) * 20 * scale))
            return (
              <div
                key={i}
                className="w-1 bg-white rounded-full transition-all duration-75"
                style={{ height: `${pct}px` }}
              />
            )
          })}
        </div>
      ) : (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )}
      {isRecording && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-ping" />
      )}
    </button>
  )
}
