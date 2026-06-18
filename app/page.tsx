'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const TEXTS = {
  es: {
    eyebrow: 'IA · Google Trends · TikTok · Amazon · 180+ países',
    title1: 'El radar de nichos',
    title2: 'dropshipping',
    title3: 'más preciso del mundo',
    sub: 'Claude AI cruza señales de Google Trends, TikTok Shop y Amazon Movers en tiempo real para encontrar nichos rentables antes que nadie.',
    cta: 'Iniciar sesión',
    ctaSub: 'Plan gratuito disponible · Sin tarjeta de crédito',
    plans: 'Ver planes →',
    f1: '✓ 5 búsquedas gratis al día',
    f2: '✓ Sin tarjeta de crédito',
    f3: '✓ Funciona en 180+ países',
  },
  en: {
    eyebrow: 'AI · Google Trends · TikTok · Amazon · 180+ countries',
    title1: 'The most precise',
    title2: 'dropshipping niche',
    title3: 'radar in the world',
    sub: 'Claude AI cross-references Google Trends, TikTok Shop and Amazon Movers in real time to find profitable niches before anyone else.',
    cta: 'Sign in',
    ctaSub: 'Free plan available · No credit card required',
    plans: 'View plans →',
    f1: '✓ 5 free searches per day',
    f2: '✓ No credit card',
    f3: '✓ Works in 180+ countries',
  },
  pt: {
    eyebrow: 'IA · Google Trends · TikTok · Amazon · 180+ países',
    title1: 'O radar de nichos',
    title2: 'dropshipping',
    title3: 'mais preciso do mundo',
    sub: 'Claude AI cruza sinais do Google Trends, TikTok Shop e Amazon Movers em tempo real para encontrar nichos lucrativos.',
    cta: 'Entrar',
    ctaSub: 'Plano gratuito disponível · Sem cartão de crédito',
    plans: 'Ver planos →',
    f1: '✓ 5 pesquisas grátis por dia',
    f2: '✓ Sem cartão de crédito',
    f3: '✓ Funciona em 180+ países',
  },
  fr: {
    eyebrow: 'IA · Google Trends · TikTok · Amazon · 180+ pays',
    title1: 'Le radar de niches',
    title2: 'dropshipping',
    title3: 'le plus précis au monde',
    sub: "Claude AI croise les signaux de Google Trends, TikTok Shop et Amazon Movers en temps réel pour trouver des niches rentables.",
    cta: 'Se connecter',
    ctaSub: 'Plan gratuit disponible · Sans carte de crédit',
    plans: 'Voir les plans →',
    f1: '✓ 5 recherches gratuites par jour',
    f2: '✓ Sans carte de crédit',
    f3: '✓ Fonctionne dans 180+ pays',
  },
  de: {
    eyebrow: 'KI · Google Trends · TikTok · Amazon · 180+ Länder',
    title1: 'Der präziseste',
    title2: 'Dropshipping-Nischen',
    title3: 'Radar der Welt',
    sub: 'Claude AI verknüpft Google Trends, TikTok Shop und Amazon Movers Signale in Echtzeit, um profitable Nischen zu finden.',
    cta: 'Anmelden',
    ctaSub: 'Kostenloser Plan verfügbar · Keine Kreditkarte',
    plans: 'Pläne ansehen →',
    f1: '✓ 5 kostenlose Suchen pro Tag',
    f2: '✓ Keine Kreditkarte',
    f3: '✓ Funktioniert in 180+ Ländern',
  },
}

export default function Home() {
  const [t, setT] = useState(TEXTS.es)

  useEffect(() => {
    const lang = navigator.language.toLowerCase().slice(0, 2)
    const map: Record<string, keyof typeof TEXTS> = {
      es: 'es', en: 'en', pt: 'pt', fr: 'fr', de: 'de',
    }
    setT(TEXTS[map[lang] ?? 'es'])
  }, [])

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', background: 'var(--c1)' }}>

      <div style={{ fontSize: 11, letterSpacing: '2px', color: 'var(--acc3)', textTransform: 'uppercase', fontWeight: 500, marginBottom: '1rem' }}>
        {t.eyebrow}
      </div>

      <h1 style={{ fontSize: 'clamp(2rem,6vw,4.5rem)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px', marginBottom: '1.25rem', maxWidth: 700 }}>
        {t.title1}<br />
        <span style={{ color: 'var(--acc)' }}>{t.title2}</span><br />
        {t.title3}
      </h1>

      <p style={{ color: 'var(--t2)', fontSize: '1.05rem', maxWidth: 520, lineHeight: 1.7, marginBottom: '2.5rem' }}>
        {t.sub}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/auth/login" className="np-btn-primary" style={{ fontSize: '1.05rem', padding: '14px 36px', textDecoration: 'none' }}>
            {t.cta}
          </Link>
          <Link href="/pricing" className="np-btn-outline" style={{ fontSize: '1rem', padding: '14px 28px' }}>
            {t.plans}
          </Link>
        </div>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>{t.ctaSub}</div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[t.f1, t.f2, t.f3].map(f => (
          <span key={f} style={{ fontSize: 13, color: 'var(--acc3)' }}>{f}</span>
        ))}
      </div>

    </main>
  )
}
