'use client'

interface Props {
  variant?: 'niche' | 'kpi' | 'list'
  count?:   number
}

function KpiSkeleton() {
  return (
    <div className="kpi-card" style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div className="skeleton" style={{ width:'60%', height:12 }}/>
      <div className="skeleton" style={{ width:'40%', height:28 }}/>
      <div className="skeleton" style={{ width:'50%', height:10 }}/>
    </div>
  )
}

function NicheSkeleton() {
  return (
    <div style={{ background:'var(--bg-subtle)', border:'1px solid var(--brd-1)', borderRadius:14, padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
          <div className="skeleton" style={{ width:'70%', height:14 }}/>
          <div style={{ display:'flex', gap:6 }}>
            <div className="skeleton" style={{ width:60, height:18, borderRadius:99 }}/>
            <div className="skeleton" style={{ width:80, height:18, borderRadius:99 }}/>
          </div>
        </div>
        <div className="skeleton skeleton-circle" style={{ width:52, height:52 }}/>
      </div>
      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {[0,1].map(i => (
          <div key={i} style={{ background:'var(--bg-muted)', borderRadius:8, padding:'8px 10px' }}>
            <div className="skeleton" style={{ width:'60%', height:13 }}/>
            <div className="skeleton" style={{ width:'40%', height:10, marginTop:5 }}/>
          </div>
        ))}
      </div>
      {/* Bar */}
      <div className="score-bar">
        <div className="skeleton" style={{ width:'65%', height:'100%' }}/>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 14px', background:'var(--bg-subtle)', borderRadius:10, border:'1px solid var(--brd-1)' }}>
      <div className="skeleton skeleton-circle" style={{ width:36, height:36 }}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
        <div className="skeleton" style={{ width:'55%', height:11 }}/>
        <div className="skeleton" style={{ width:'35%', height:9 }}/>
      </div>
      <div className="skeleton" style={{ width:40, height:11 }}/>
    </div>
  )
}

export default function SkeletonCard({ variant='niche', count=3 }: Props) {
  const arr = Array.from({ length: count })
  if (variant === 'kpi')  return <>{arr.map((_,i) => <KpiSkeleton  key={i} />)}</>
  if (variant === 'list') return <>{arr.map((_,i) => <ListSkeleton key={i} />)}</>
  return <>{arr.map((_,i) => <NicheSkeleton key={i} />)}</>
}
