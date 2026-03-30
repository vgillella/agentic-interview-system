import { useState } from 'react'
import './index.css'
import ResumeUpload from './components/ResumeUpload'
import ChatInterface from './components/ChatInterface'
import ReportPage from './pages/Report'

type View = 'upload' | 'interview' | 'report'

export default function App() {
  const [view, setView] = useState<View>('upload')
  const [sessionId, setSessionId] = useState('')
  const [studentName, setStudentName] = useState('')

  const handleUploadComplete = (sid: string, name: string) => {
    setSessionId(sid)
    setStudentName(name)
    setView('interview')
  }

  const handleInterviewComplete = (sid: string) => {
    setSessionId(sid)
    setView('report')
  }

  if (view === 'upload') {
    return <ResumeUpload onUploadComplete={handleUploadComplete} />
  }
  if (view === 'interview') {
    return (
      <ChatInterface
        sessionId={sessionId}
        studentName={studentName}
        onComplete={handleInterviewComplete}
      />
    )
  }
  return <ReportPage sessionId={sessionId} />
}
