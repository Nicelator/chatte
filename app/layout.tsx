import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chatte — Random Video Chat',
  description: 'Meet interesting people. Anonymous, free, no signup.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'Chatte — Random Video Chat',
    description: 'Meet interesting people. Anonymous, free, no signup.',
    url: 'https://chatte.vercel.app',
    siteName: 'Chatte',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Chatte — Random Video Chat',
    description: 'Meet interesting people. Anonymous, free, no signup.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
