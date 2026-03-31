import { useEffect, useRef, useState } from 'react'
import { useInterview } from '../hooks/useInterview'
import PhaseIndicator from './PhaseIndicator'
import VoiceRecorder from './VoiceRecorder'
import Logo from './Logo'

interface Props {
  sessionId: string
  studentName: string
  onComplete: (sessionId: string) => void
}

export default function ChatInterface({ sessionId, studentName, onComplete }: Props) {
  const { state, phaseLabel, startInterview, startRecording, stopRecording, sendTextMessage, dismissAnxiety } = useInterview(sessionId, studentName)
  const [textInput, setTextInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!started.current) {
      started.current = true
      startInterview()
    }
  }, [startInterview])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages])

  useEffect(() => {
    if (state.interviewComplete) {
      setTimeout(() => onComplete(sessionId), 2000)
    }
  }, [state.interviewComplete, sessionId, onComplete])

  const handleSendText = () => {
    if (!textInput.trim() || state.isLoading) return
    sendTextMessage(textInput.trim())
    setTextInput('')
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f0f13]">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={32} showWordmark={false} />
            <div>
              <h2 className="text-white font-medium text-sm">{studentName}</h2>
              <p className="text-slate-400 text-xs">{phaseLabel}</p>
            </div>
          </div>
          <PhaseIndicator currentPhase={state.phase} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {state.messages.length === 0 && state.isLoading && (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          )}

          {state.messages.map((msg, i) => (
            <div
              key={i}
              data-testid={`message-${msg.role}`}
              className={`flex ${msg.role === 'candidate' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'interviewer' && (
                <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-xs text-white mr-2 mt-0.5 flex-shrink-0">
                  AI
                </div>
              )}
              <div className={`
                max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'interviewer'
                  ? 'bg-slate-800 text-slate-200 rounded-tl-sm'
                  : 'bg-indigo-600 text-white rounded-tr-sm'
                }
              `}>
                {msg.text}
              </div>
            </div>
          ))}

          {state.isLoading && state.messages.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-xs text-white flex-shrink-0">AI</div>
              <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {state.interviewComplete && (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">Interview complete. Generating your report…</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Anxiety overlay */}
      {state.anxietyDetected && (
        <div
          data-testid="anxiety-overlay"
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-10"
        >
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-sm text-center shadow-2xl">
            <div className="text-3xl mb-4">🌿</div>
            <p className="text-white font-medium mb-2">Take a moment</p>
            <p className="text-slate-400 text-sm mb-6">There's no rush. Breathe, and continue whenever you're ready.</p>
            <button
              data-testid="anxiety-dismiss"
              onClick={dismissAnxiety}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
            >
              I'm ready to continue
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      {!state.interviewComplete && (
        <div className="border-t border-slate-800 bg-slate-900/60 backdrop-blur px-4 py-4">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            <div className="flex-1">
              <textarea
                data-testid="text-input"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendText()
                  }
                }}
                placeholder="Type your answer or hold the mic button to speak…"
                rows={2}
                disabled={state.isLoading}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <button
                data-testid="send-btn"
                onClick={handleSendText}
                disabled={!textInput.trim() || state.isLoading}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
              <VoiceRecorder
                isRecording={state.isRecording}
                isLoading={state.isLoading}
                disabled={state.interviewComplete}
                audioLevel={state.audioLevel}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
              />
            </div>
          </div>
          {state.error && (
            <p data-testid="chat-error" className="text-red-400 text-xs text-center mt-2">{state.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
