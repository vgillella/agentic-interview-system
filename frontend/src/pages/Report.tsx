// Full implementation in Task 8
import { useEffect, useState } from 'react'
import axios from 'axios'

interface Props {
  sessionId: string
}

interface Report {
  overall_score: number
  phase2_score: { depth_level: number; hint_responsiveness: number }
  phase3_score: { depth_level: number; hint_responsiveness: number }
  phase4_score: { correct_count: number; total_questions: number }
  phase5_score: { visionary: number; grounded: number; team_player: number }
  report_json: {
    summary: string
    strengths: string[]
    gaps: string[]
    recommendations: string[]
  }
}

export default function ReportPage({ sessionId }: Props) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const generate = async () => {
      try {
        const { data } = await axios.post(`/api/report/${sessionId}`)
        setReport(data)
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Failed to generate report.')
      } finally {
        setLoading(false)
      }
    }
    generate()
  }, [sessionId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f13]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Generating your interview report…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f13]">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!report) return null

  const scoreColor = (n: number, max = 10) => {
    const pct = n / max
    if (pct >= 0.7) return 'text-green-400'
    if (pct >= 0.4) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-white tracking-tight mb-1">Interview Report</h1>
          <p className="text-slate-500 text-sm">Overall Score</p>
          <p className={`text-5xl font-bold mt-2 ${scoreColor(report.overall_score, 100)}`}>
            {report.overall_score.toFixed(0)}
            <span className="text-2xl text-slate-500">/100</span>
          </p>
        </div>

        {/* Phase scores */}
        <div className="grid grid-cols-2 gap-4">
          <ScoreCard title="Deep Dive I" data={[
            { label: 'Depth Level', value: `${report.phase2_score?.depth_level ?? '–'}/10` },
            { label: 'Hint Responsiveness', value: `${((report.phase2_score?.hint_responsiveness ?? 0) * 100).toFixed(0)}%` },
          ]} />
          <ScoreCard title="Deep Dive II" data={[
            { label: 'Depth Level', value: `${report.phase3_score?.depth_level ?? '–'}/10` },
            { label: 'Hint Responsiveness', value: `${((report.phase3_score?.hint_responsiveness ?? 0) * 100).toFixed(0)}%` },
          ]} />
          <ScoreCard title="ML Fundamentals" data={[
            { label: 'Correct Answers', value: `${report.phase4_score?.correct_count ?? 0}/${report.phase4_score?.total_questions ?? 5}` },
          ]} />
          <ScoreCard title="Behavioral" data={[
            { label: 'Visionary', value: `${report.phase5_score?.visionary ?? '–'}/10` },
            { label: 'Grounded', value: `${report.phase5_score?.grounded ?? '–'}/10` },
            { label: 'Team Player', value: `${report.phase5_score?.team_player ?? '–'}/10` },
          ]} />
        </div>

        {/* Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-2 text-sm">Summary</h3>
          <p className="text-slate-400 text-sm leading-relaxed">{report.report_json?.summary}</p>
        </div>

        {/* Strengths & Gaps */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-green-400 font-medium mb-3 text-sm">Strengths</h3>
            <ul className="space-y-1">
              {(report.report_json?.strengths || []).map((s, i) => (
                <li key={i} className="text-slate-300 text-sm flex gap-2">
                  <span className="text-green-500 flex-shrink-0">+</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-red-400 font-medium mb-3 text-sm">Areas to Improve</h3>
            <ul className="space-y-1">
              {(report.report_json?.gaps || []).map((g, i) => (
                <li key={i} className="text-slate-300 text-sm flex gap-2">
                  <span className="text-red-400 flex-shrink-0">–</span>{g}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-indigo-400 font-medium mb-3 text-sm">Recommendations</h3>
          <ul className="space-y-2">
            {(report.report_json?.recommendations || []).map((r, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-indigo-500 flex-shrink-0">{i + 1}.</span>{r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function ScoreCard({ title, data }: { title: string; data: { label: string; value: string }[] }) {
  return (
    <div data-testid={`score-card-${title}`} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-slate-500 text-xs">{d.label}</span>
            <span className="text-white text-sm font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
