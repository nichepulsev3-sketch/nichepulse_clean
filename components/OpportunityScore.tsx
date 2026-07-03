'use client'
import { scoreColor, scoreLabel, scoreGradient } from '@/lib/types'
import type { NicheResult } from '@/lib/types'

interface Props {
  niche:   NicheResult
  size?:   'sm' | 'md' | 'lg'
  showBreakdown?: boolean
}

const SIGNAL_LABELS: Record<string, [string, string]> = {
  demand:      ['Demanda',     '📈'],
  competition: ['Competencia', '⚔️'],
  margin:      ['Margen',      '💰'],
  trend:       ['Tendencia',   '🔥'],
  tiktok:      ['TikTok',      '📱'],
  seo:         ['SEO',         '🔍'],
  amazon:      ['Amazon',      '📦'],
  virality:    ['Viralidad',   '🚀'],
  scalability: ['Escalabilidad','📊'],
  saturation:  ['Saturación',  '🎯'],
}

export default function OpportunityScore({ niche, size='md', showBreakdown=false }: Props) {
  const score    = niche.opportunity_score ?? niche.score ?? 0
  const confidence = niche.confidence ?? Math.round(score * 0.9)
  const color    = scoreColor(score)
  const label    = scoreLabel(score)
  const gradient = scoreGradient(score)

  const radius   = size==='lg' ? 52 : size==='md' ? 38 : 26
  const stroke   = size==='lg' ? 7   : size==='md' ? 5.5 : 4
  const circ     = 2 * Math.PI * radius
  const fill     = (score / 100) * circ

  const dim = (radius + stroke) * 2
  const center = radius + stroke

  const fontSize = size==='lg' ? '1.8rem' : size==='md' ? '1.3rem' : '1rem'
  const labelSize = size==='lg' ? 11 : size==='md' ? 10 : 9

  return (
    <div>
      {/* Ring */}
      <div style={{ display:'flex', alignItems:'center', gap: size==='sm'?8:12 }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} style={{ transform:'rotate(-90deg)' }}>
            <defs>
              <linearGradient id={`sg-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
                {score >= 86 ? <>
                  <stop offset="0%"   stopColor="#7c6fff"/>
                  <stop offset="100%" stopColor="#2dd4bf"/>
                </> : score >= 71 ? <>
                  <stop offset="0%"   stopColor="#7c6fff"/>
                  <stop offset="100%" stopColor="#f471b5"/>
                </> : score >= 51 ? <>
                  <stop offset="0%"   stopColor="#fbbf24"/>
                  <stop offset="100%" stopColor="#a3e635"/>
                </> : <>
                  <stop offset="0%"   stopColor="#f43f5e"/>
                  <stop offset="100%" stopColor="#f97316"/>
                </>}
              </linearGradient>
            </defs>
            {/* Track */}
            <circle cx={center} cy={center} r={radius} fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
            {/* Fill */}
            <circle cx={center} cy={center} r={radius} fill="none"
              stroke={`url(#sg-${score})`} strokeWidth={stroke}
              strokeDasharray={`${fill} ${circ}`}
              strokeLinecap="round"
              style={{ transition:'stroke-dasharray 1s var(--ease-out)' }}
            />
          </svg>
          {/* Score value */}
          <div style={{
            position:'absolute', inset:0,
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
          }}>
            <span style={{ fontSize, fontWeight:800, color, lineHeight:1, fontFamily:'var(--font-display)' }}>{score}</span>
            {size !== 'sm' && <span style={{ fontSize:labelSize-1, color:'var(--txt-3)', fontWeight:500 }}>Score</span>}
          </div>
        </div>

        {/* Label + confidence */}
        {size !== 'sm' && (
          <div>
            <div style={{ fontSize: size==='lg'?16:13, fontWeight:700, color }}>{label}</div>
            <div style={{ fontSize:11, color:'var(--txt-3)', marginTop:3 }}>
              Confianza: <span style={{ color:'var(--txt-2)', fontWeight:500 }}>{confidence}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Breakdown */}
      {showBreakdown && niche.signals && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:11, color:'var(--txt-3)', textTransform:'uppercase', letterSpacing:'0.8px', fontWeight:600, marginBottom:10 }}>
            Desglose de señales
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {Object.entries(niche.signals).map(([key, val]) => {
              const [lbl, icon] = SIGNAL_LABELS[key] ?? [key, '●']
              const pct = (Number(val) / 10) * 100
              const barColor = pct >= 70 ? 'var(--teal)' : pct >= 50 ? 'var(--brand)' : pct >= 30 ? 'var(--amber)' : 'var(--red)'
              return (
                <div key={key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, width:20, textAlign:'center' }}>{icon}</span>
                  <span style={{ fontSize:12, color:'var(--txt-2)', width:90, flexShrink:0 }}>{lbl}</span>
                  <div style={{ flex:1, height:4, borderRadius:99, background:'var(--bg-raised)', overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:barColor, borderRadius:99, transition:'width 0.6s var(--ease-out)' }}/>
                  </div>
                  <span style={{ fontSize:12, color:'var(--txt-2)', width:20, textAlign:'right', fontWeight:600 }}>{val}</span>
                </div>
              )
            })}
          </div>

          {/* How to improve */}
          {niche.score_improvement && (
            <div style={{ marginTop:12, background:'var(--bg-raised)', borderRadius:10, padding:'10px 12px', borderLeft:'2px solid var(--brand)' }}>
              <div style={{ fontSize:11, color:'var(--brand)', fontWeight:600, marginBottom:3 }}>💡 Cómo mejorar el score</div>
              <div style={{ fontSize:12, color:'var(--txt-2)', lineHeight:1.5 }}>{niche.score_improvement}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
