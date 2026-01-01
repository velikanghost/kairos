'use client'

import Link from 'next/link'

interface LogoProps {
  href?: string
  size?: 'sm' | 'md'
}

export default function Logo({ href = '/', size = 'md' }: LogoProps) {
  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
  }

  const content = (
    <h1 className="text-2xl font-bold leading-none bg-linear-to-b from-white to-gray-600 bg-clip-text text-transparent">
      Kairos
    </h1>
  )

  if (href) {
    return (
      <Link href={href} className="flex items-center">
        {content}
      </Link>
    )
  }

  return content
}
