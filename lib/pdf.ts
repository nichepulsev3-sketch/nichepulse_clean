/**
 * NichePulse — Generador de PDF sin diálogo de impresión
 * Usa jsPDF para crear el PDF directamente en memoria y descargarlo.
 */
import type { NicheResult } from './supabase'
import { SCORE_META, SCORE_ORDER, scoreCardColor } from './types'
import { createLogger } from './logger'

const log = createLogger('pdf')

// jsPDF trabaja en RGB, el Motor de Inteligencia expone colores en hex —
// pequeño conversor para no duplicar la paleta de scoreCardColor aquí.
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)]
}

// Importación dinámica para evitar SSR issues
async function getJsPDF() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}

// Colores tema NichePulse
const PURPLE = [124, 111, 255] as [number, number, number]
const PINK   = [255, 107, 157] as [number, number, number]
const TEAL   = [0,   229, 195] as [number, number, number]
const ORANGE = [255, 153,   0] as [number, number, number]
const DARK   = [ 26,  26,  46] as [number, number, number]
const GRAY   = [160, 160, 192] as [number, number, number]
const LIGHT  = [245, 245, 255] as [number, number, number]
const WHITE  = [255, 255, 255] as [number, number, number]

function hex(r:number, g:number, b:number) { return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}` }

export async function downloadNichePDF(niche: NicheResult, plan: string, currency: string) {
  const JsPDF   = await getJsPDF()
  const doc     = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const isAgency = plan === 'agency'
  const accentR  = isAgency ? ORANGE : PURPLE
  const W        = 210, MARGIN = 15
  const CW       = W - MARGIN * 2   // content width
  let   Y        = MARGIN

  // ── Helpers ──────────────────────────────────────────────────
  function setFill(c: [number,number,number]) { doc.setFillColor(c[0],c[1],c[2]) }
  function setDraw(c: [number,number,number]) { doc.setDrawColor(c[0],c[1],c[2]) }
  function setFont(size:number, style:'normal'|'bold'='normal', color=DARK) {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
    doc.setTextColor(color[0],color[1],color[2])
  }
  function newPage() { doc.addPage(); Y = MARGIN }
  function checkY(needed=20) { if (Y + needed > 270) newPage() }
  function wrap(text: string, maxW: number, size=10): string[] {
    doc.setFontSize(size)
    return doc.splitTextToSize(text, maxW)
  }

  // ── ENCABEZADO con gradiente simulado ────────────────────────
  const headerH = 38
  setFill(accentR); doc.roundedRect(MARGIN, Y, CW, headerH, 4, 4, 'F')
  // Barra de acento interior
  setFill(isAgency ? ORANGE : PINK)
  doc.rect(MARGIN + CW - 4, Y, 4, headerH, 'F')

  // Etiqueta plan
  setFont(7,'bold', WHITE)
  doc.text(`NICHEPULSE · ${isAgency ? 'AGENCY EXPERT' : 'PRO'} · Multi-motor de IA`, MARGIN + 4, Y + 6)

  // Nombre del nicho
  setFont(14, 'bold', WHITE)
  const nameLines = wrap(niche.name, CW - 25, 14)
  nameLines.slice(0,2).forEach((line, i) => doc.text(line, MARGIN + 4, Y + 15 + i * 7))

  // Moneda
  setFont(8, 'normal', [200, 240, 255])
  doc.text(`${currency} · ${niche.competition} competencia · ${niche.trend}`, MARGIN + 4, Y + 30)

  // Score círculo
  setFill(WHITE)
  doc.circle(MARGIN + CW - 14, Y + 19, 11, 'F')
  setFont(14, 'bold', accentR)
  doc.text(String(niche.opportunity_score ?? niche.profit_score ?? 0), MARGIN + CW - 18, Y + 22)
  setFont(6, 'normal', GRAY)
  doc.text('Score', MARGIN + CW - 18.5, Y + 27)

  Y += headerH + 6

  // ── MÉTRICAS en grid ─────────────────────────────────────────
  const metrics = [
    ['Mercado', niche.market_size],
    ['Margen', niche.margin],
    ['Ticket prom.', niche.avg_ticket ?? 'N/D'],
    ['Competencia', niche.competition],
  ]
  const mW = (CW - 6) / 4
  metrics.forEach(([label, value], i) => {
    const x = MARGIN + i * (mW + 2)
    setFill(LIGHT); doc.roundedRect(x, Y, mW, 14, 2, 2, 'F')
    setFont(9, 'bold', accentR)
    doc.text(value, x + mW / 2, Y + 6, { align: 'center' })
    setFont(7, 'normal', GRAY)
    doc.text(label, x + mW / 2, Y + 11, { align: 'center' })
  })
  Y += 20

  // Tags
  setFont(7, 'normal', accentR)
  niche.tags.forEach((tag, i) => {
    const tw = doc.getTextWidth(tag) + 4
    const x  = MARGIN + i * (tw + 2)
    if (x + tw > MARGIN + CW - 20) return
    setFill(LIGHT); doc.roundedRect(x, Y, tw, 5, 1, 1, 'F')
    doc.text(tag, x + 2, Y + 3.5)
  })
  Y += 10

  // ── Función sección ───────────────────────────────────────────
  function section(title: string, color = accentR) {
    checkY(16)
    setFill(color)
    doc.rect(MARGIN, Y, 2.5, 8, 'F')
    setFont(9, 'bold', color)
    doc.text(title.toUpperCase(), MARGIN + 5, Y + 6)
    setDraw([220, 220, 240])
    doc.setLineWidth(0.2)
    doc.line(MARGIN + 5 + doc.getTextWidth(title.toUpperCase()) + 2, Y + 4, MARGIN + CW, Y + 4)
    Y += 10
  }

  function bulletItem(text: string, color = accentR, prefix = '•') {
    const lines = wrap(text, CW - 10)
    const blockH = lines.length * 4.5 + 4
    checkY(blockH + 2)
    setFill(LIGHT); doc.roundedRect(MARGIN, Y, CW, blockH, 1.5, 1.5, 'F')
    setFill(color); doc.rect(MARGIN, Y, 2, blockH, 'F')
    setFont(8, 'normal', DARK)
    lines.forEach((line, li) => doc.text(line, MARGIN + 5, Y + 4.5 + li * 4.5))
    Y += blockH + 2
  }

  // ── Veredicto del Motor de Inteligencia ─────────────────────────
  // Lo primero que debe leer el usuario: qué hacer, no solo un número.
  if (niche.verdict) {
    const vColor: [number, number, number] = niche.verdict === 'invertir' ? TEAL : niche.verdict === 'evitar' ? PINK : ORANGE
    const vLabel = niche.verdict === 'invertir' ? '✅ INVERTIR' : niche.verdict === 'evitar' ? '🚫 EVITAR' : '⏳ ESPERAR'
    section('Veredicto del Motor de Inteligencia', vColor)
    const lines = wrap(`${vLabel}${niche.verdict_reason ? ' — ' + niche.verdict_reason : ''}`, CW - 10)
    const h = lines.length * 4.5 + 6
    checkY(h + 4)
    setFill(LIGHT); doc.roundedRect(MARGIN, Y, CW, h, 2, 2, 'F')
    setDraw(vColor); doc.setLineWidth(0.6); doc.rect(MARGIN, Y, CW, h, 'S')
    setFont(9, 'bold', vColor)
    lines.forEach((l, i) => doc.text(l, MARGIN + 4, Y + 5.5 + i * 4.5))
    Y += h + 5
  }

  // ── Motor de Inteligencia — 12 scores explicados (Pro/Agency) ───
  if (niche.scores) {
    section('🧠 Motor de Inteligencia — 12 scores', accentR)
    SCORE_ORDER.forEach(key => {
      const card = niche.scores?.[key]
      if (!card) return
      const meta = SCORE_META[key]
      const color = hexToRgb(scoreCardColor(key, card.value))
      const reasonsTxt = card.reasons.length ? ` — ${card.reasons.join(', ')}` : ''
      bulletItem(`${meta.icon} ${meta.label}: ${card.value}/100${reasonsTxt}`, color)
    })
  }

  // ── Agency: veredicto experto y ROI ─────────────────────────
  if (isAgency) {
    if (niche.expert_verdict) {
      section('🏆 Veredicto del equipo experto', ORANGE)
      const lines = wrap(niche.expert_verdict, CW - 10)
      const h     = lines.length * 4.5 + 6
      checkY(h + 4)
      setFill([255, 248, 230]); doc.roundedRect(MARGIN, Y, CW, h, 2, 2, 'F')
      setDraw(ORANGE); doc.setLineWidth(0.6); doc.rect(MARGIN, Y, CW, h, 'S')
      setFont(8, 'bold', DARK)
      lines.forEach((l, i) => doc.text(l, MARGIN + 4, Y + 5.5 + i * 4.5))
      Y += h + 5
    }
    if (niche.validated_roi) {
      section('💰 ROI validado', TEAL)
      bulletItem(niche.validated_roi, TEAL)
    }
  }

  // ── Ángulo ganador ────────────────────────────────────────────
  if (niche.winning_angle) {
    section('🎯 Ángulo ganador de marketing', isAgency ? ORANGE : PURPLE)
    const lines = wrap(`"${niche.winning_angle}"`, CW - 10)
    const h = lines.length * 4.5 + 6
    checkY(h + 4)
    setFill([240, 238, 255]); doc.roundedRect(MARGIN, Y, CW, h, 2, 2, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bolditalic')
    doc.setTextColor(PURPLE[0], PURPLE[1], PURPLE[2])
    lines.forEach((l, i) => doc.text(l, MARGIN + 4, Y + 5.5 + i * 4.5))
    doc.setFont('helvetica', 'normal')
    Y += h + 5
  }

  // ── Público objetivo ─────────────────────────────────────────
  if (niche.target_audience) {
    section('👥 Público objetivo', isAgency ? ORANGE : PURPLE)
    bulletItem(niche.target_audience, isAgency ? ORANGE : PURPLE)
  }

  // ── Insights (dos columnas) ───────────────────────────────────
  section('💡 Insights del Multi-motor de IA', accentR);
  (niche.strengths ?? niche.insights ?? []).forEach((ins: string) => bulletItem(ins, accentR))

  // ── Riesgos ───────────────────────────────────────────────────
  if (niche.risks && niche.risks.length) {
    section('⚠️ Riesgos a considerar', PINK)
    niche.risks.forEach(r => bulletItem(r, PINK))
  }

  // ── Cómo empezar ─────────────────────────────────────────────
  if (niche.getting_started && niche.getting_started.length) {
    section('🚀 Cómo empezar', TEAL)
    niche.getting_started.forEach((step, i) => bulletItem(`${i + 1}. ${step}`, TEAL))
  }

  // ── Proveedores ───────────────────────────────────────────────
  section('📦 Proveedores recomendados', accentR)
  niche.suppliers.forEach(s => {
    checkY(10)
    setFill(LIGHT); doc.roundedRect(MARGIN, Y, CW, 9, 1.5, 1.5, 'F')
    setFont(8, 'bold', DARK);  doc.text(s.name, MARGIN + 4, Y + 5.5)
    setFont(7, 'normal', GRAY); doc.text(s.note, MARGIN + 4 + doc.getTextWidth(s.name) + 4, Y + 5.5)
    setFont(7, 'bold', accentR)
    const link = s.name.toLowerCase().includes('aliexpress') ? `aliexpress.com/wholesale?SearchText=${encodeURIComponent(niche.keywords[0]??niche.name)}` : s.name.toLowerCase().includes('amazon') ? `amazon.com/s?k=${encodeURIComponent(niche.keywords[0]??niche.name)}` : 'google.com/search'
    doc.text('Ver →', MARGIN + CW - 14, Y + 5.5)
    Y += 11
  })

  // ── Estacionalidad ────────────────────────────────────────────
  if (niche.seasonality) {
    section('📅 Estacionalidad', accentR)
    bulletItem(niche.seasonality, accentR)
  }

  // ── Keywords ─────────────────────────────────────────────────
  section('🔍 Keywords principales', accentR)
  checkY(12)
  let kwX = MARGIN
  niche.keywords.forEach(kw => {
    const tw = doc.getTextWidth(kw) + 6
    if (kwX + tw > MARGIN + CW) { kwX = MARGIN; Y += 7 }
    checkY(8)
    setFill(LIGHT); doc.roundedRect(kwX, Y, tw, 5.5, 1, 1, 'F')
    setFont(7, 'normal', accentR)
    doc.text(kw, kwX + 3, Y + 4)
    kwX += tw + 2
  })
  Y += 9

  // ── Canales ───────────────────────────────────────────────────
  section('📢 Canales publicitarios', accentR)
  checkY(8)
  kwX = MARGIN
  niche.ad_channels.forEach(ch => {
    const tw = doc.getTextWidth(ch) + 6
    if (kwX + tw > MARGIN + CW) { kwX = MARGIN; Y += 7 }
    setFill(accentR); doc.roundedRect(kwX, Y, tw, 5.5, 1, 1, 'F')
    setFont(7, 'bold', WHITE)
    doc.text(ch, kwX + 3, Y + 4)
    kwX += tw + 2
  })
  Y += 12

  // ── Footer en todas las páginas ───────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const date = new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' })
    setFill([230, 228, 255])
    doc.rect(0, 285, 210, 12, 'F')
    setFont(7, 'normal', GRAY)
    doc.text(`NichePulse · Multi-motor de IA · ${date} · Moneda: ${currency}`, MARGIN, 291)
    setFont(7, 'bold', accentR)
    doc.text(`Pág ${i}/${totalPages}`, W - MARGIN, 291, { align: 'right' })
  }

  // ── Descarga multiplataforma (PC / Android / iOS) ─────────────
  const filename = `nichepulse-${plan}-${niche.name.replace(/\s+/g,'-').toLowerCase().slice(0,30)}.pdf`
  await triggerDownload(doc, filename)
  log.info('PDF descargado', { filename })
}

/**
 * Informe ejecutivo v2 — resume una sesión de búsqueda completa (no un
 * solo nicho): ranking comparativo de todos los nichos analizados +
 * plan de acción a 30/60/90 días generado por IA a partir de los que
 * el Motor de Inteligencia marcó como "invertir". El texto del plan se
 * genera en el servidor (app/api/executive-report) y llega ya listo
 * aquí — este archivo solo se encarga de maquetarlo en PDF.
 */
export async function downloadExecutiveReportPDF(
  niches: NicheResult[], plan: string, currency: string, query: string, actionPlan: string[]
) {
  const JsPDF    = await getJsPDF()
  const doc      = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const isAgency = plan === 'agency'
  const accentR  = isAgency ? ORANGE : PURPLE
  const W        = 210, MARGIN = 15
  const CW       = W - MARGIN * 2
  let   Y        = MARGIN

  function setFill(c: [number,number,number]) { doc.setFillColor(c[0],c[1],c[2]) }
  function setDraw(c: [number,number,number]) { doc.setDrawColor(c[0],c[1],c[2]) }
  function setFont(size:number, style:'normal'|'bold'='normal', color=DARK) {
    doc.setFontSize(size); doc.setFont('helvetica', style); doc.setTextColor(color[0],color[1],color[2])
  }
  function newPage() { doc.addPage(); Y = MARGIN }
  function checkY(needed=20) { if (Y + needed > 270) newPage() }
  function wrap(text: string, maxW: number, size=10): string[] { doc.setFontSize(size); return doc.splitTextToSize(text, maxW) }
  function section(title: string, color = accentR) {
    checkY(16)
    setFill(color); doc.rect(MARGIN, Y, 2.5, 8, 'F')
    setFont(9, 'bold', color); doc.text(title.toUpperCase(), MARGIN + 5, Y + 6)
    setDraw([220,220,240]); doc.setLineWidth(0.2)
    doc.line(MARGIN + 5 + doc.getTextWidth(title.toUpperCase()) + 2, Y + 4, MARGIN + CW, Y + 4)
    Y += 10
  }
  function bulletItem(text: string, color = accentR) {
    const lines = wrap(text, CW - 10)
    const blockH = lines.length * 4.5 + 4
    checkY(blockH + 2)
    setFill(LIGHT); doc.roundedRect(MARGIN, Y, CW, blockH, 1.5, 1.5, 'F')
    setFill(color); doc.rect(MARGIN, Y, 2, blockH, 'F')
    setFont(8, 'normal', DARK)
    lines.forEach((line, li) => doc.text(line, MARGIN + 5, Y + 4.5 + li * 4.5))
    Y += blockH + 2
  }

  // ── ENCABEZADO ────────────────────────────────────────────────
  const headerH = 34
  setFill(accentR); doc.roundedRect(MARGIN, Y, CW, headerH, 4, 4, 'F')
  setFill(isAgency ? ORANGE : PINK); doc.rect(MARGIN + CW - 4, Y, 4, headerH, 'F')
  setFont(7, 'bold', WHITE)
  doc.text(`NICHEPULSE · INFORME EJECUTIVO · ${isAgency ? 'AGENCY EXPERT' : 'PRO'}`, MARGIN + 4, Y + 6)
  setFont(13, 'bold', WHITE)
  wrap(`Sesión de búsqueda: "${query}"`, CW - 10, 13).slice(0,2).forEach((l,i)=>doc.text(l, MARGIN + 4, Y + 15 + i*7))
  setFont(8, 'normal', [200,240,255])
  const date = new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' })
  doc.text(`${niches.length} nichos analizados · ${currency} · ${date}`, MARGIN + 4, Y + 29)
  Y += headerH + 8

  // ── RESUMEN EJECUTIVO ─────────────────────────────────────────
  const investCount = niches.filter(n => n.verdict === 'invertir').length
  const waitCount    = niches.filter(n => n.verdict === 'esperar').length
  const avoidCount   = niches.filter(n => n.verdict === 'evitar').length
  section('Resumen de la sesión', accentR)
  bulletItem(`De ${niches.length} nichos analizados: ${investCount} para invertir ahora, ${waitCount} para esperar, ${avoidCount} para evitar. Ordenados por Opportunity Score a continuación.`, accentR)

  // ── RANKING COMPARATIVO ───────────────────────────────────────
  section('🏆 Ranking comparativo', accentR)
  const ranked = [...niches].sort((a,b) => (b.opportunity_score??b.profit_score??0) - (a.opportunity_score??a.profit_score??0))
  ranked.forEach((n, i) => {
    checkY(12)
    const score = n.opportunity_score ?? n.profit_score ?? 0
    const vColor: [number,number,number] = n.verdict === 'invertir' ? TEAL : n.verdict === 'evitar' ? PINK : ORANGE
    const vLabel = n.verdict === 'invertir' ? 'INVERTIR' : n.verdict === 'evitar' ? 'EVITAR' : 'ESPERAR'
    setFill(LIGHT); doc.roundedRect(MARGIN, Y, CW, 11, 1.5, 1.5, 'F')
    setFill(vColor); doc.rect(MARGIN, Y, 2, 11, 'F')
    setFont(8, 'bold', DARK); doc.text(`${i+1}. ${n.name}`, MARGIN + 5, Y + 5)
    setFont(7, 'normal', GRAY)
    wrap(n.verdict_reason || n.conclusion || '', CW - 40, 7).slice(0,1).forEach(l => doc.text(l, MARGIN + 5, Y + 9))
    setFont(9, 'bold', vColor); doc.text(String(score), MARGIN + CW - 26, Y + 6, { align: 'center' })
    setFont(6, 'bold', vColor); doc.text(vLabel, MARGIN + CW - 26, Y + 9.5, { align: 'center' })
    Y += 13
  })
  Y += 4

  // ── PLAN DE ACCIÓN 30/60/90 ───────────────────────────────────
  if (actionPlan.length) {
    section('📆 Plan de acción 30/60/90 días', TEAL)
    const labels = ['Días 1-30', 'Días 31-60', 'Días 61-90']
    actionPlan.slice(0,3).forEach((step, i) => bulletItem(`${labels[i] ?? `Fase ${i+1}`}: ${step}`, TEAL))
  } else if (investCount === 0) {
    section('📆 Plan de acción 30/60/90 días', TEAL)
    bulletItem('Ningún nicho de esta sesión alcanzó el veredicto "Invertir" — el plan de acción se genera solo sobre oportunidades validadas. Prueba con otra búsqueda o ajusta los filtros.', GRAY)
  }

  // ── Footer ─────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    setFill([230,228,255]); doc.rect(0, 285, 210, 12, 'F')
    setFont(7, 'normal', GRAY)
    doc.text(`NichePulse · Informe ejecutivo · ${date} · Moneda: ${currency}`, MARGIN, 291)
    setFont(7, 'bold', accentR)
    doc.text(`Pág ${i}/${totalPages}`, W - MARGIN, 291, { align: 'right' })
  }

  const filename = `nichepulse-informe-ejecutivo-${query.replace(/\s+/g,'-').toLowerCase().slice(0,30)}.pdf`
  await triggerDownload(doc, filename)
  log.info('Informe ejecutivo descargado', { filename })
}

// ── Detección de plataforma ──────────────────────────────────────
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPad en iOS 13+ se identifica como Mac, se detecta por touch
  const isIpadOS = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
  return /iPad|iPhone|iPod/.test(ua) || isIpadOS
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/.test(navigator.userAgent)
}

// ── Descarga robusta: PC normal, Android via blob+anchor, iOS via Web Share ──
async function triggerDownload(doc: any, filename: string) {
  const blob = doc.output('blob') as Blob

  // iOS Safari: doc.save() casi siempre falla o abre una pestaña en blanco.
  // Usamos Web Share API (comparte/guarda en Archivos) como método principal,
  // con fallback a abrir el PDF en una nueva pestaña si Share no está disponible.
  if (isIOS()) {
    const file = new File([blob], filename, { type: 'application/pdf' })
    const nav = navigator as Navigator & {
      share?: (data: { files?: File[]; title?: string }) => Promise<void>
      canShare?: (data: { files?: File[] }) => boolean
    }

    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: filename })
        return
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        log.warn('Share falló, usando fallback', { error: err?.message ?? String(err) })
      }
    }

    // Fallback iOS: abrir el PDF en nueva pestaña — el usuario puede
    // usar el botón "Compartir → Guardar en Archivos" desde el visor nativo
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (!win) {
      // Si el navegador bloqueó la ventana emergente, forzar navegación directa
      window.location.href = url
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    return
  }

  // Android Chrome / navegadores móviles modernos: blob + <a download>
  // funciona de forma fiable y descarga directamente a la carpeta Descargas
  if (isAndroid()) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return
  }

  // PC / escritorio: doc.save() de jsPDF funciona perfectamente
  doc.save(filename)
}
