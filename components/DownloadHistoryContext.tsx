'use client'

import React from 'react'

// Placeholder context - implement as needed
export function useDownloadHistory() {
  return {
    downloads: [],
    refreshDownloads: () => {},
  }
}

export default function DownloadHistoryProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}