'use client'

/**
 * global-error.tsx — Next.js App Router llama a este componente cuando
 * un error se escapa del layout raíz (algo que un error.tsx normal no
 * puede capturar). Fase 4: "Unhandled Errors" también en el árbol de
 * React, no solo en API routes.
 */
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body style={{ background: '#0d0d18', color: '#e8e8f5', fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>El error ya se ha registrado. Intenta recargar la página.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#7c6fff', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Recargar
          </button>
        </div>
      </body>
    </html>
  )
}
