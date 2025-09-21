'use client'

import React, { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

// SVG Icons
const VideoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const DownloadIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const LinkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
)

const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
)

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const HistoryIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

export default function Home() {
  const { data: session, status } = useSession()
  const [url, setUrl] = useState('')
  const [message, setMessage] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadStats, setDownloadStats] = useState<{
    fileSize?: string
    downloadTime?: string
    cached?: boolean
    activeDownloads?: string
  }>({})

  // History sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [downloadHistory, setDownloadHistory] = useState<{
    id: string
    title: string
    url: string
    platform: string
    fileSize: string
    timestamp: Date
  }[]>([])

  // Load history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('downloadHistory')
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setDownloadHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })))
      } catch (error) {
        console.error('Error loading download history:', error)
      }
    }
  }, [])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (downloadHistory.length > 0) {
      localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory))
    }
  }, [downloadHistory])

  // History management functions
  const addToHistory = (item: {
    title: string
    url: string
    platform: string
    fileSize: string
  }) => {
    const historyItem = {
      id: Date.now().toString(),
      ...item,
      timestamp: new Date()
    }
    setDownloadHistory(prev => [historyItem, ...prev].slice(0, 50)) // Keep only 50 most recent
  }

  const removeFromHistory = (id: string) => {
    setDownloadHistory(prev => prev.filter(item => item.id !== id))
  }

  const clearHistory = () => {
    setDownloadHistory([])
    localStorage.removeItem('downloadHistory')
  }

  const getMessageStyle = () => {
    if (message.includes('successful') || message.includes('completed')) {
      return 'bg-green-50 text-green-800 border border-green-200'
    }
    if (message.includes('error') || message.includes('Error') || message.includes('failed')) {
      return 'bg-red-50 text-red-800 border border-red-200'
    }
    return 'bg-blue-50 text-blue-800 border border-blue-200'
  }

  const handleDownload = async () => {
    if (!url.trim()) {
      setMessage('Please enter a valid URL')
      return
    }

    setIsDownloading(true)
    setMessage('Processing your request...')
    setDownloadProgress(0)
    setDownloadStats({})

    const progressInterval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 95) return 95
        return prev + Math.random() * 15
      })
    }, 500)

    const timeoutId = setTimeout(() => {
      setMessage('Request is taking longer than expected. The download might still be processing on the server.')
      setDownloadProgress(90)
    }, 30000)

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      console.log(response);
      clearInterval(progressInterval)
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.text()
        let errorMessage = errorData
        
        try {
          const parsedError = JSON.parse(errorData)
          errorMessage = parsedError.error || errorData
          
          // Show more helpful messages for production issues
          if (errorMessage.includes('Download failed')) {
            errorMessage = 'Video download is temporarily unavailable. Our system is being updated to support more platforms. Please try again later.'
          } else if (errorMessage.includes('Method not allowed')) {
            errorMessage = 'Service temporarily unavailable. Please refresh the page and try again.'
          }
        } catch {
          // If not JSON, use as is
          errorMessage = 'Download service temporarily unavailable. Please try again later.'
        }
        
        throw new Error(errorMessage || `Service error (${response.status})`)
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch ? filenameMatch[1] : 'video'
      
      const fileSize = response.headers.get('X-File-Size')
      const downloadTime = response.headers.get('X-Download-Time')
      const cacheStatus = response.headers.get('X-Cache-Status')
      const activeDownloads = response.headers.get('X-Active-Downloads')
      const videoTitle = response.headers.get('X-Video-Title') || 'Downloaded Video'
      const platform = response.headers.get('X-Platform') || 'Unknown'

      setDownloadProgress(100)
      setDownloadStats({
        fileSize: fileSize || undefined,
        downloadTime: downloadTime ? `${Math.round(parseInt(downloadTime) / 1000)}s` : undefined,
        cached: cacheStatus === 'HIT',
        activeDownloads: activeDownloads || undefined
      })
      
      // Start download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      window.URL.revokeObjectURL(downloadUrl)
      
      const cacheMessage = cacheStatus === 'HIT' ? ' (cached)' : ''
      setMessage(`Download successful${cacheMessage}`)
      
      // Add to download history
      addToHistory({
        title: videoTitle,
        url: url,
        platform: platform,
        fileSize: fileSize || 'Unknown size'
      })
      
    } catch (error: any) {
      clearInterval(progressInterval)
      clearTimeout(timeoutId)
      console.error('Download error:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setIsDownloading(false)
      setDownloadProgress(0)
    }
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Main Content Container */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'mr-80' : 'mr-0'
      }`}>
        {/* Navigation */}
        <nav className="bg-white border-b border-gray-200 px-4 py-4 flex justify-around items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Link2Vid</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {status === 'loading' ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
            ) : session ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-gray-600 hover:text-gray-800"
                >
                  <HistoryIcon className="w-5 h-5" />
                  <span className="text-sm">History</span>
                </button>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/auth/signin" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  Sign in
                </Link>
                <Link href="/auth/signup" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Download videos from any platform</h2>
              <p className="text-lg text-gray-600 mb-6">Fast, reliable, and secure video downloading service</p>
              
              {/* Supported Platforms */}
              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500 mb-8">
                <span className="flex items-center gap-2">
                  <CheckIcon className="w-3 h-3 text-green-600" />
                  YouTube
                </span>
                <span className="flex items-center gap-2">
                  <CheckIcon className="w-3 h-3 text-green-600" />
                  Instagram
                </span>
                <span className="flex items-center gap-2">
                  <CheckIcon className="w-3 h-3 text-green-600" />
                  Twitter
                </span>
                <span className="flex items-center gap-2">
                  <CheckIcon className="w-3 h-3 text-green-600" />
                  TikTok
                </span>
              </div>
            </div>

            {/* Download Form */}
            <div className="bg-white rounded-lg p-6 mb-6 shadow-md border border-gray-100">
              <div className="space-y-4">
                <div>
                  <label htmlFor="url" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <LinkIcon className="w-4 h-4" />
                    Video URL
                  </label>
                  <input
                    type="url"
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-4 py-3 rounded-lg text-sm border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-gray-900"
                    disabled={isDownloading}
                  />
                </div>

                <button
                  onClick={handleDownload}
                  disabled={isDownloading || !url.trim()}
                  className={`w-full py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${
                    isDownloading || !url.trim()
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isDownloading ? (
                    <>
                      <LoadingSpinner className="w-4 h-4" />
                      Processing
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="w-4 h-4" />
                      Download Video
                    </>
                  )}
                </button>
              </div>

              {/* Progress Bar */}
              {isDownloading && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-600">Progress</span>
                    <span className="text-xs text-gray-600">{Math.round(downloadProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Status Message */}
            {message && (
              <div className={`p-4 rounded-lg text-sm mb-6 ${getMessageStyle()}`}>
                <div className="flex items-center gap-2">
                  {message.includes('successful') || message.includes('completed') ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : isDownloading ? (
                    <LoadingSpinner className="w-4 h-4" />
                  ) : (
                    <InfoIcon className="w-4 h-4" />
                  )}
                  <span>{message}</span>
                </div>
              </div>
            )}

            {/* Download Stats */}
            {(downloadStats.fileSize || downloadStats.downloadTime || downloadStats.cached || downloadStats.activeDownloads) && (
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Download Information</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {downloadStats.fileSize && (
                    <div>
                      <div className="text-gray-500">File Size</div>
                      <div className="text-gray-900 font-medium">{downloadStats.fileSize}</div>
                    </div>
                  )}
                  {downloadStats.downloadTime && (
                    <div>
                      <div className="text-gray-500">Duration</div>
                      <div className="text-gray-900 font-medium">{downloadStats.downloadTime}</div>
                    </div>
                  )}
                  {downloadStats.cached && (
                    <div>
                      <div className="text-gray-500">Source</div>
                      <div className="text-green-600 font-medium">Cache</div>
                    </div>
                  )}
                  {downloadStats.activeDownloads && (
                    <div>
                      <div className="text-gray-500">Server Load</div>
                      <div className="text-gray-900 font-medium">{downloadStats.activeDownloads}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <footer className="mt-16 py-8 border-t border-gray-200">
              <div className="text-center text-xs text-gray-500">
                <p>Secure video downloading with enterprise-grade infrastructure</p>
                <p className="mt-1">Rate limiting and caching for optimal performance</p>
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* Right Side History Sidebar - Only for logged-in users */}
      {session && (
        <div className={`fixed top-0 right-0 h-full bg-white transition-all duration-300 ease-in-out z-40 ${
          isSidebarOpen ? 'w-80 border-l border-gray-200' : 'w-0'
        } overflow-hidden`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <HistoryIcon className="w-5 h-5" />
                Download History
              </h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRightIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {downloadHistory.length > 0 && (
              <button
                onClick={clearHistory}
                className="mt-2 text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <TrashIcon className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {downloadHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <HistoryIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No downloads yet</p>
                <p className="text-xs text-gray-400 mt-1">Your download history will appear here</p>
              </div>
            ) : (
              <div className="p-2">
                {downloadHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 mb-2 rounded-lg hover:bg-gray-50 border border-gray-100 group cursor-pointer"
                    onClick={() => {
                      setUrl(item.url)
                      setIsSidebarOpen(false)
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-800 truncate">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.platform} • {item.fileSize}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFromHistory(item.id)
                        }}
                        className="p-1 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <TrashIcon className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  )
}