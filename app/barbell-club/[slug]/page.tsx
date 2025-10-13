"use client"

import { useEffect, use } from "react"
import { useRouter } from "next/navigation"

// Redirect route for backward compatibility
// Redirects /barbell-club/[slug] to /club/[slug]
export default function BarbelClubRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const { slug } = use(params)

  useEffect(() => {
    // Redirect to the new club route
    router.replace(`/club/${slug}`)
  }, [slug, router])

  // Show a minimal loading state during redirect
  return (
    <div className="min-h-screen bg-app-gradient flex items-center justify-center">
      <div className="text-app-secondary">Redirecting...</div>
    </div>
  )
}
