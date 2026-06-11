import { redirect } from 'next/navigation'

export default function RefPage({ params }: { params: { code: string } }) {
  redirect(`/auth/login?ref=${params.code}`)
}
