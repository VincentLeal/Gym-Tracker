import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gym Tracker',
  description: 'Suivi de séances Push / Pull / Legs',
  manifest: '/manifest.json',
  themeColor: '#0f6e56',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Gym Tracker' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 min-h-screen text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
