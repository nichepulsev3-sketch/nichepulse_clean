import Link from 'next/link'

/**
 * Política de Privacidad — AUDITORIA_LANZAMIENTO_V1.md, Fase 13/15 (P0.7).
 *
 * NichePulse no tenía ninguna página legal antes de este cambio, pese a
 * captar cuentas de usuario, procesar pagos con Stripe y usar cookies
 * de sesión (Supabase Auth) -- un requisito real, no opcional, para
 * cualquier lanzamiento público, especialmente con usuarios en la UE.
 *
 * IMPORTANTE: este es un borrador razonable basado en lo que la app
 * realmente hace (verificado en el código: Supabase para datos y auth,
 * Stripe para pagos, Anthropic/OpenAI para el análisis de IA, Resend
 * para emails). No sustituye una revisión legal real -- se recomienda
 * que un abogado la revise antes o poco después del lanzamiento,
 * especialmente si hay usuarios en la UE (RGPD).
 */
export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--c1)', color: 'var(--t1)', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--t3)', textDecoration: 'none' }}>← Volver</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', margin: '1rem 0 0.5rem' }}>Política de Privacidad</h1>
        <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: '2rem' }}>Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <Section title="1. Quiénes somos">
          NichePulse ("nosotros", "la plataforma") es un servicio de análisis de oportunidades de negocio en ecommerce/dropshipping. Para cualquier consulta sobre esta política o tus datos, escríbenos a <a href="mailto:soporte@nichepulse.com" style={{ color: 'var(--acc)' }}>soporte@nichepulse.com</a>.
        </Section>

        <Section title="2. Qué datos recogemos">
          Cuenta: email y contraseña (gestionados por Supabase Auth, nunca almacenamos tu contraseña en texto plano). Uso del servicio: las búsquedas de nichos que realizas, los nichos que guardas en favoritos o vigilas en tu watchlist, y tus interacciones con la plataforma (esto alimenta el motor de recomendaciones — ver la sección de Inteligencia Artificial más abajo). Pago: si contratas un plan de pago, Stripe procesa tu tarjeta directamente — nosotros nunca vemos ni almacenamos el número completo de tu tarjeta. Técnicos: dirección IP y user-agent, usados únicamente para seguridad (limitar abusos) y para el correcto funcionamiento de tu sesión.
        </Section>

        <Section title="3. Cookies">
          Usamos únicamente cookies estrictamente necesarias para mantener tu sesión iniciada (gestionadas por Supabase Auth). No usamos cookies de publicidad ni de rastreo de terceros.
        </Section>

        <Section title="4. Inteligencia Artificial">
          Cuando analizas un nicho, tu consulta se envía a proveedores de IA (Anthropic Claude y, en algunos casos, OpenAI) para generar el análisis. Estos proveedores procesan el texto de tu consulta bajo sus propias políticas de privacidad; no les enviamos tu email ni datos de pago. El histórico de tus búsquedas puede usarse, de forma agregada y anónima junto con el de otros usuarios, para mejorar la calidad de las recomendaciones — nunca se comparte tu actividad individual con otros usuarios.
        </Section>

        <Section title="5. Con quién compartimos tus datos">
          Solo con los proveedores estrictamente necesarios para operar el servicio: Supabase (base de datos y autenticación), Stripe (pagos), Anthropic/OpenAI (análisis de IA), Resend (emails transaccionales) y Railway (alojamiento). No vendemos ni alquilamos tus datos a terceros con fines publicitarios.
        </Section>

        <Section title="6. Cuánto tiempo conservamos tus datos">
          Mientras tu cuenta esté activa. Si la eliminas, borramos tus datos personales en un plazo razonable, salvo que la ley nos obligue a conservar algún registro (por ejemplo, facturación).
        </Section>

        <Section title="7. Tus derechos">
          Si resides en la Unión Europea (RGPD) u otra jurisdicción con protecciones similares, tienes derecho a acceder, rectificar, eliminar, limitar el tratamiento, oponerte al uso de tus datos, y a la portabilidad de los mismos. Escríbenos a <a href="mailto:soporte@nichepulse.com" style={{ color: 'var(--acc)' }}>soporte@nichepulse.com</a> para ejercer cualquiera de estos derechos.
        </Section>

        <Section title="8. Seguridad">
          Tus datos están protegidos mediante controles de acceso a nivel de fila en nuestra base de datos (cada usuario solo puede ver sus propios datos), conexiones cifradas (HTTPS) y autenticación segura. Ningún sistema es 100% infalible, pero tomamos medidas razonables para proteger tu información.
        </Section>

        <Section title="9. Cambios en esta política">
          Si hacemos cambios relevantes, lo indicaremos en esta misma página con la fecha de actualización.
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
