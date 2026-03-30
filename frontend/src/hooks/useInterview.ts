import { useState, useCallback, useRef } from 'react'
import axios from 'axios'

export interface Message {
  role: 'interviewer' | 'candidate'
  text: string
  timestamp: number
}

export interface InterviewState {
  sessionId: string
  studentName: string
  phase: number
  messages: Message[]
  isLoading: boolean
  isRecording: boolean
  anxietyDetected: boolean
  interviewComplete: boolean
  error: string
}

const PHASE_LABELS: Record<number, string> = {
  1: 'Background',
  2: 'Technical Deep Dive I',
  3: 'Technical Deep Dive II',
  4: 'ML Fundamentals',
  5: 'Behavioral',
  6: 'Complete',
}

export function useInterview(sessionId: string, studentName: string) {
  const [state, setState] = useState<InterviewState>({
    sessionId,
    studentName,
    phase: 1,
    messages: [],
    isLoading: false,
    isRecording: false,
    anxietyDetected: false,
    interviewComplete: false,
    error: '',
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const addMessage = useCallback((role: 'interviewer' | 'candidate', text: string) => {
    setState(s => ({
      ...s,
      messages: [...s.messages, { role, text, timestamp: Date.now() }],
    }))
  }, [])

  const playAudio = useCallback(async (text: string) => {
    try {
      const res = await axios.post('/api/synthesize', { text }, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const audio = new Audio(url)
      audio.play()
      audio.onended = () => URL.revokeObjectURL(url)
    } catch {
      // TTS failure is non-fatal — text is already shown
    }
  }, [])

  const startInterview = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: '' }))
    try {
      const { data } = await axios.post('/api/interview/start', { session_id: sessionId })
      addMessage('interviewer', data.message)
      setState(s => ({ ...s, phase: data.phase, isLoading: false }))
      await playAudio(data.message)
    } catch (e: any) {
      setState(s => ({ ...s, isLoading: false, error: 'Failed to start interview.' }))
    }
  }, [sessionId, addMessage, playAudio])

  const sendTextMessage = useCallback(async (text: string) => {
    addMessage('candidate', text)
    setState(s => ({ ...s, isLoading: true, error: '' }))
    try {
      const { data } = await axios.post('/api/interview/message', {
        session_id: sessionId,
        user_message: text,
      })
      addMessage('interviewer', data.message)
      setState(s => ({
        ...s,
        phase: data.phase,
        isLoading: false,
        interviewComplete: data.interview_complete || false,
      }))
      await playAudio(data.message)
    } catch (e: any) {
      setState(s => ({ ...s, isLoading: false, error: 'Failed to send message.' }))
    }
  }, [sessionId, addMessage, playAudio])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.start()
      mediaRecorderRef.current = mr
      setState(s => ({ ...s, isRecording: true }))
    } catch {
      setState(s => ({ ...s, error: 'Microphone access denied.' }))
    }
  }, [])

  const stopRecording = useCallback(async () => {
    const mr = mediaRecorderRef.current
    if (!mr) return
    mr.stop()
    mr.stream.getTracks().forEach(t => t.stop())
    setState(s => ({ ...s, isRecording: false, isLoading: true }))

    await new Promise<void>(resolve => { mr.onstop = () => resolve() })

    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    const form = new FormData()
    form.append('audio', blob, 'recording.webm')

    try {
      const { data } = await axios.post('/api/transcribe', form)
      const { transcript, anxiety_detected, anxiety_message } = data

      if (anxiety_detected) {
        setState(s => ({ ...s, anxietyDetected: true, isLoading: false }))
        addMessage('interviewer', anxiety_message)
        await playAudio(anxiety_message)
        return
      }

      setState(s => ({ ...s, anxietyDetected: false }))
      if (transcript) await sendTextMessage(transcript)
      else setState(s => ({ ...s, isLoading: false }))
    } catch {
      setState(s => ({ ...s, isLoading: false, error: 'Transcription failed.' }))
    }
  }, [addMessage, sendTextMessage, playAudio])

  const dismissAnxiety = useCallback(() => {
    setState(s => ({ ...s, anxietyDetected: false }))
  }, [])

  return {
    state,
    phaseLabel: PHASE_LABELS[state.phase] || 'Interview',
    startInterview,
    startRecording,
    stopRecording,
    sendTextMessage,
    dismissAnxiety,
  }
}
