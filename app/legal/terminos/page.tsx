import Link from 'next/link'

/**
 * Términos de Servicio — AUDITORIA_LANZAMIENTO_V1.md, Fase 13/15 (P0.7).
 * Ver nota importante sobre revisión legal en app/legal/privacidad/page.tsx.
 */
export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--c1)', color: 'var(--t1)', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--t3)', textDecoration: 'none' }}>← Volver</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', margin: '1rem 0 0.5rem' }}>Términos de Servicio</h1>
        <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: '2rem' }}>Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <Section title="1. Aceptación">
          Al crear una cuenta o usar NichePulse, aceptas estos términos. Si no estás de acuerdo, no uses el servicio.
        </Section>

        <Section title="2. Qué es NichePulse">
          NichePulse es una herramienta de análisis de mercado que usa inteligencia artificial y señales de datos públicos para ayudarte a evaluar oportunidades de negocio en ecommerce/dropshipping. Los análisis, scores y predicciones son orientativos: reflejan nuestro mejor esfuerzo por interpretar señales de mercado disponibles, no una garantía de resultado.
        </Section>

        <Section title="3. Esto no es asesoramiento financiero">
          Nada en NichePulse constituye asesoramiento financiero, legal o de inversión profesional. Las decisiones de negocio que tomes basándote en la plataforma son tu responsabilidad. El "Opportunity Score" y cualquier veredicto ("invertir", "esperar", "evitar") son una estimación basada en datos disponibles en el momento del análisis, no una promesa de éxito.
        </Section>

        <Section title="4. Tu cuenta">
          Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad bajo tu cuenta. Debes proporcionar información veraz al registrarte.
        </Section>

        <Section title="5. Planes y pagos">
          Los planes de pago (Pro, Agency) se facturan de forma recurrente a través de Stripe según el ciclo indicado en el momento de la contratación. Puedes cancelar en cualquier momento desde tu panel — la cancelación aplica al final del periodo ya pagado, sin reembolso proporcional salvo que la ley aplicable exija lo contrario. Los límites de uso (búsquedas diarias, funciones disponibles) dependen del plan contratado y pueden consultarse en la página de precios.
        </Section>

        <Section title="6. Uso aceptable">
          No debes: usar la plataforma para actividades ilegales, intentar acceder a datos de otros usuarios, sobrecargar deliberadamente el servicio, ni usar scraping o automatización no autorizada contra la plataforma. Nos reservamos el derecho de suspender cuentas que incumplan estas condiciones.
        </Section>

        <Section title="7. Propiedad intelectual">
          El software, diseño, marca y contenido propio de NichePulse nos pertenecen. Los datos y análisis generados para tu cuenta son tuyos para tu uso; no puedes revenderlos como un producto de datos independiente sin autorización.
        </Section>

        <Section title="8. Disponibilidad del servicio">
          Nos esforzamos por mantener el servicio disponible, pero no garantizamos un uptime del 100%. Podemos realizar mantenimiento, y algunas funciones dependen de proveedores externos (Anthropic, OpenAI, Stripe, Supabase) cuya disponibilidad no controlamos directamente.
        </Section>

        <Section title="9. Limitación de responsabilidad">
          NichePulse se ofrece "tal cual". En la medida permitida por la ley, no somos responsables de pérdidas de negocio, beneficios o datos derivadas del uso (o la imposibilidad de uso) de la plataforma, ni de decisiones de negocio tomadas a partir de sus análisis.
        </Section>

        <Section title="10. Cambios en estos términos">
          Podemos actualizar estos términos; los cambios relevantes se indicarán con la fecha de actualización en esta página. El uso continuado del servicio tras un cambio implica su aceptación.
        </Section>

        <Section title="11. Contacto">
          Para cualquier duda sobre estos términos, escríbenos a <a href="mailto:soporte@nichepulse.com" style={{ color: 'var(--acc)' }}>soporte@nichepulse.com</a>.
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>{title}</h2>
      <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>{children}</p>
    </div>
  )
}
