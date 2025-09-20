import React from 'react'
import './globals.css'
import { Inter } from 'next/font/google'
import AuthProvider from '../components/AuthProvider'
import GoogleAdsense from '../components/GoogleAdsense'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Link2Vid - Fast Video Downloads',
  description: 'Download videos from YouTube, Instagram, TikTok, and more platforms quickly and easily.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GoogleAdsense />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}