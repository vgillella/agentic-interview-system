import { useState, useCallback } from 'react'
import axios from 'axios'
import Logo from './Logo'

interface Props {
  onUploadComplete: (sessionId: string, studentName: string) => void
}

const POLL_INTERVAL = 3000
const POLL_MAX_ATTEMPTS = 40  // 40 × 3s = 120s max wait

async function pollUntilReady(sessionId: string): Promise<{ student_name: string }> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL))
    const { data } = await axios.get(`/api/session/${sessionId}/status`)
    if (data.status === 'ready') return data
    if (data.status === 'parse_failed') throw new Error('Resume parsing failed on the server.')
  }
  throw new Error('Resume parsing timed out. Please try again.')
}

export default function ResumeUpload({ onUploadComplete }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('Parsing your resume…')
  const [error, setError] = useState('')

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file.')
      return
    }
    setError('')
    setLoading(true)
    setStatusText('Uploading…')
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await axios.post('/api/upload-resume', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setStatusText('Parsing your resume with AI… this takes about 30 seconds.')
      const ready = await pollUntilReady(data.session_id)
      onUploadComplete(data.session_id, ready.student_name || 'Candidate')
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [onUploadComplete])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f13]">
      <div className="w-full max-w-lg px-4">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Logo size={56} showWordmark={true} />
          </div>
          <h1 className="text-3xl font-light text-white tracking-tight mb-2">
            AI Interview Agent
          </h1>
          <p className="text-slate-400 text-sm">Upload your resume to begin the interview</p>
        </div>

        <div
          data-testid="drop-zone"
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
            ${dragging
              ? 'border-indigo-400 bg-indigo-950/30'
              : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
            }
          `}
          onClick={() => !loading && document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            data-testid="file-input"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">{statusText}</p>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-4">📄</div>
              <p className="text-slate-300 font-medium">Drop your resume PDF here</p>
              <p className="text-slate-500 text-sm mt-1">or click to browse</p>
            </>
          )}
        </div>

        {error && (
          <p data-testid="upload-error" className="mt-4 text-red-400 text-sm text-center">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
