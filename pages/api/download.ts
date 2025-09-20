import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../lib/auth'
import { saveDownload } from '../../lib/downloads'
import youtubedl from 'youtube-dl-exec'
import { createReadStream, unlinkSync, existsSync } from 'fs'
import path from 'path'
import NodeCache from 'node-cache'
import crypto from 'crypto'

// Production-ready configuration
const config = {
  // Rate limiting: requests per IP per time window
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // max 5 downloads per 15 minutes per IP (more conservative)
  },
  // Concurrency limiting
  maxConcurrentDownloads: 3, // max 3 simultaneous downloads (reduced for stability)
  // Caching - cache actual video files for repeated downloads
  cache: {
    ttl: 2 * 60 * 60, // 2 hours cache for downloaded videos
    checkPeriod: 30 * 60, // cleanup every 30 minutes
    maxSize: 100, // max 100 cached videos
  },
  // File size and security limits
  maxFileSizeMB: 100, // 100MB max file size (more conservative)
  maxDurationSeconds: 600, // 10 minutes max video duration
  // Retry configuration
  maxRetries: 2, // reduced retries
  retryDelay: 3000, // 3 seconds
  // Security settings
  allowedDomains: [
    'youtube.com', 'youtu.be', 'instagram.com', 'facebook.com', 
    'twitter.com', 'x.com', 'tiktok.com', 'twitch.tv'
  ],
  // Timeouts
  downloadTimeoutMs: 5 * 60 * 1000, // 5 minute timeout
}

// Initialize caches
const rateLimitCache = new NodeCache({ stdTTL: config.rateLimit.windowMs / 1000 })
const videoCache = new NodeCache({ 
  stdTTL: config.cache.ttl, 
  checkperiod: config.cache.checkPeriod,
  maxKeys: config.cache.maxSize
})

// Safe concurrency management
let activeDownloads = 0
const maxConcurrent = config.maxConcurrentDownloads

// Rate limiting with proper TTL tracking
function checkRateLimit(clientIP: string): { allowed: boolean; retryAfter?: number } {
  const key = `rate_${clientIP}`
  const requestData = rateLimitCache.get<{ count: number; firstRequest: number }>(key)
  const now = Date.now()
  
  if (!requestData) {
    // First request
    rateLimitCache.set(key, { count: 1, firstRequest: now })
    return { allowed: true }
  }
  
  // Check if window has expired
  if (now - requestData.firstRequest > config.rateLimit.windowMs) {
    // Reset window
    rateLimitCache.set(key, { count: 1, firstRequest: now })
    return { allowed: true }
  }
  
  if (requestData.count >= config.rateLimit.maxRequests) {
    const retryAfter = Math.ceil((config.rateLimit.windowMs - (now - requestData.firstRequest)) / 1000)
    return { allowed: false, retryAfter }
  }
  
  // Increment count
  rateLimitCache.set(key, { count: requestData.count + 1, firstRequest: requestData.firstRequest })
  return { allowed: true }
}

// Get client IP address
function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded ? 
    (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]) : 
    req.connection.remoteAddress || 'unknown'
  return ip
}

// Security: validate URL domain
function isAllowedDomain(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.toLowerCase()
    
    return config.allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    )
  } catch {
    return false
  }
}

// Generate cache key for video URL
function getCacheKey(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex')
}

// Sanitize filename for HTTP header
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s\-_.()]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Replace multiple spaces
    .trim() // Remove leading/trailing whitespace
    .substring(0, 180) // Limit length
}

// Enhanced retry mechanism with timeouts
async function retryOperation<T>(
  operation: () => Promise<T>, 
  maxRetries: number = config.maxRetries,
  delay: number = config.retryDelay,
  timeoutMs: number = config.downloadTimeoutMs
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wrap operation with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      })
      
      return await Promise.race([operation(), timeoutPromise])
    } catch (error) {
      lastError = error as Error
      console.log(`Attempt ${attempt} failed:`, error)
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
      }
    }
  }
  
  throw lastError!
}

// Wait for available slot with timeout
async function waitForSlot(): Promise<void> {
  const maxWaitTime = 60000 // 1 minute max wait
  const checkInterval = 1000 // check every second
  const startTime = Date.now()
  
  while (activeDownloads >= maxConcurrent) {
    if (Date.now() - startTime > maxWaitTime) {
      throw new Error('Server too busy. Please try again later.')
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }
}

// Idempotent cleanup function
function createCleanupFunction(outputPath: string): () => void {
  let cleaned = false
  
  return () => {
    if (cleaned) return
    cleaned = true
    
    try {
      if (outputPath && existsSync(outputPath)) {
        unlinkSync(outputPath)
        console.log('Temporary file deleted:', outputPath)
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError)
    } finally {
      // Safely decrement counter
      if (activeDownloads > 0) {
        activeDownloads--
      }
      console.log(`Active downloads: ${activeDownloads}`)
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Debug logging
  console.log('API Request Method:', req.method)
  console.log('API Request Headers:', req.headers)
  console.log('API Request Body:', req.body)
  
  // Only allow POST requests - Updated for production fix
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { url } = req.body
  const clientIP = getClientIP(req)
  
  // Validate URL parameter
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' })
  }
  
  // Basic URL validation
  try {
    new URL(url)
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' })
  }
  
  // Security: check domain allowlist
  if (!isAllowedDomain(url)) {
    return res.status(400).json({ 
      error: 'Domain not supported. Supported domains: ' + config.allowedDomains.join(', ')
    })
  }
  
  // Rate limiting check
  const rateLimitResult = checkRateLimit(clientIP)
  if (!rateLimitResult.allowed) {
    return res.status(429).json({ 
      error: `Rate limit exceeded. Max ${config.rateLimit.maxRequests} downloads per ${config.rateLimit.windowMs / 60000} minutes.`,
      retryAfter: rateLimitResult.retryAfter || 900
    })
  }
  
  let outputPath: string | undefined
  let cleanup: (() => void) | undefined
  const startTime = Date.now()
  
  try {
    // Check cache first - this actually provides value now
    const cacheKey = getCacheKey(url)
    const cachedVideo = videoCache.get<{
      filePath: string
      filename: string
      contentType: string
      size: number
    }>(cacheKey)
    
    if (cachedVideo && existsSync(cachedVideo.filePath)) {
      console.log('Serving from cache:', cachedVideo.filename)
      
      // Set headers for cached download
      res.setHeader('Content-Type', cachedVideo.contentType)
      res.setHeader('Content-Length', cachedVideo.size)
      res.setHeader('Content-Disposition', `attachment; filename="${cachedVideo.filename}"`)
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('X-Download-Time', '0')
      
      // Stream cached file
      const fileStream = createReadStream(cachedVideo.filePath)
      fileStream.pipe(res)
      return
    }
    
    // Wait for available download slot
    await waitForSlot()
    
    // Increment active downloads
    activeDownloads++
    console.log(`[${new Date().toISOString()}] Starting download for URL: ${url} (Active: ${activeDownloads}/${maxConcurrent})`)
    
    // Generate unique filename
    const timestamp = Date.now()
    const tempDir = '/tmp'
    const outputTemplate = path.join(tempDir, `video_${timestamp}_%(title)s.%(ext)s`)
    
    // Download with comprehensive options and retry
    console.log('Starting youtube-dl-exec for URL:', url)
    const output = await retryOperation(async () => {
      try {
        console.log('Attempting youtube-dl-exec with outputTemplate:', outputTemplate)
        const result = await youtubedl(url, {
          output: outputTemplate,
          // More flexible format selection with fallbacks
          format: 'best[height<=720]/best',
          noPlaylist: true,
          writeInfoJson: false,
          writeThumbnail: false,
          retries: 1, // Let our retry mechanism handle retries
          ignoreErrors: false,
          // Additional security and performance options
          preferFreeFormats: true,
          addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'],
        })
        console.log('youtube-dl-exec successful, result:', result)
        return result
      } catch (error: any) {
        console.error('youtube-dl-exec error:', {
          message: error.message,
          stderr: error.stderr,
          stdout: error.stdout,
          stack: error.stack
        })
        
        // Handle specific format errors for Instagram
        if (error.message && error.message.includes('Requested format is not available')) {
          console.log('Retrying with basic format selector')
          // Try with a more basic format selector
          const result = await youtubedl(url, {
            output: outputTemplate,
            format: 'best',
            noPlaylist: true,
            writeInfoJson: false,
            writeThumbnail: false,
            retries: 1,
            ignoreErrors: false,
            preferFreeFormats: true,
            addHeader: ['User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'],
          })
          console.log('Retry successful, result:', result)
          return result
        }
        throw error
      }
    })
    
    const downloadTime = Date.now() - startTime
    console.log('Download completed in', downloadTime, 'ms')
    
    // Find downloaded file
    const files = require('fs').readdirSync(tempDir)
    const downloadedFile = files.find((file: string) => 
      file.startsWith(`video_${timestamp}_`) && 
      !file.endsWith('.part')
    )
    
    if (!downloadedFile) {
      throw new Error('Downloaded file not found')
    }
    
    outputPath = path.join(tempDir, downloadedFile)
    
    if (!existsSync(outputPath)) {
      throw new Error('Downloaded file does not exist')
    }
    
    // Get file stats and validate
    const fs = require('fs')
    const stats = fs.statSync(outputPath)
    const fileSize = stats.size
    const fileSizeMB = fileSize / (1024 * 1024)
    
    if (fileSizeMB > config.maxFileSizeMB) {
      throw new Error(`File too large: ${fileSizeMB.toFixed(1)}MB (max: ${config.maxFileSizeMB}MB)`)
    }
    
    console.log(`File size: ${fileSizeMB.toFixed(1)}MB`)
    
    // Determine content type
    const ext = path.extname(downloadedFile).toLowerCase()
    const contentTypes: { [key: string]: string } = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.flv': 'video/x-flv',
      '.m4v': 'video/mp4',
    }
    const contentType = contentTypes[ext] || 'application/octet-stream'
    const sanitizedFilename = sanitizeFilename(downloadedFile)
    
    // Cache the video for future requests (only if not too large)
    if (fileSizeMB < 50) { // Only cache videos under 50MB
      const cacheFilePath = path.join('/tmp', `cached_${cacheKey}${ext}`)
      try {
        // Copy to cache location
        require('fs').copyFileSync(outputPath, cacheFilePath)
        videoCache.set(cacheKey, {
          filePath: cacheFilePath,
          filename: sanitizedFilename,
          contentType,
          size: fileSize
        })
        console.log('Video cached for future requests')
      } catch (cacheError) {
        console.warn('Failed to cache video:', cacheError)
      }
    }
    
    // Set response headers with proper caching and timeout handling
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', fileSize)
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Keep-Alive', 'timeout=300, max=1000')
    res.setHeader('X-Cache', 'MISS')
    res.setHeader('X-Download-Time', downloadTime.toString())
    res.setHeader('X-File-Size', fileSizeMB.toFixed(1) + 'MB')
    res.setHeader('X-Active-Downloads', activeDownloads.toString())
    
    // Save download to database if user is logged in
    try {
      const session = await getServerSession(req, res, authOptions)
      if (session?.user) {
        // Extract platform from URL
        let platform = 'unknown'
        try {
          const urlObj = new URL(url)
          const hostname = urlObj.hostname.toLowerCase()
          if (hostname.includes('youtube')) platform = 'YouTube'
          else if (hostname.includes('instagram')) platform = 'Instagram'
          else if (hostname.includes('facebook')) platform = 'Facebook'
          else if (hostname.includes('twitter') || hostname.includes('x.com')) platform = 'Twitter/X'
          else if (hostname.includes('tiktok')) platform = 'TikTok'
          else if (hostname.includes('twitch')) platform = 'Twitch'
        } catch {}
        
        await saveDownload({
          userId: (session.user as any).id,
          url: url,
          title: sanitizedFilename.replace(/^video_\d+_/, '').replace(/\.[^.]+$/, ''), // Clean title
          filename: sanitizedFilename,
          platform: platform,
          fileSize: `${fileSizeMB.toFixed(1)}MB`
        })
        console.log('Download saved to user history')
      }
    } catch (dbError) {
      console.warn('Failed to save download to database:', dbError)
      // Don't fail the download if database save fails
    }
    
    // Create idempotent cleanup function
    cleanup = createCleanupFunction(outputPath)
    
    // Create file stream
    const fileStream = createReadStream(outputPath)
    
    // Handle stream events with proper cleanup
    fileStream.on('error', (error) => {
      console.error('File stream error:', error)
      if (cleanup) cleanup()
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming file' })
      }
    })
    
    fileStream.on('end', () => {
      console.log('File streaming completed')
      if (cleanup) cleanup()
    })
    
    req.on('close', () => {
      console.log('Client disconnected')
      if (cleanup) cleanup()
    })
    
    // Stream file to response
    fileStream.pipe(res)
    
    console.log(`[${new Date().toISOString()}] Successfully streamed: ${sanitizedFilename}`)
    
  } catch (error) {
    console.error('Download error:', error)
    
    // Cleanup on error
    if (cleanup) {
      cleanup()
    } else if (outputPath && existsSync(outputPath)) {
      try {
        unlinkSync(outputPath)
        activeDownloads = Math.max(0, activeDownloads - 1)
      } catch (cleanupError) {
        console.error('Error cleaning up:', cleanupError)
      }
    }
    
    // Enhanced error messages
    let errorMessage = 'Download failed'
    let statusCode = 500
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase()
      
      if (errorMsg.includes('server too busy')) {
        errorMessage = 'Server is currently busy. Please try again in a few minutes.'
        statusCode = 503
      } else if (errorMsg.includes('timed out')) {
        errorMessage = 'Download timed out. Please try again with a shorter video.'
        statusCode = 408
      } else if (errorMsg.includes('unsupported url')) {
        errorMessage = 'This URL is not supported'
        statusCode = 400
      } else if (errorMsg.includes('video unavailable')) {
        errorMessage = 'Video is unavailable or private'
        statusCode = 404
      } else if (errorMsg.includes('file too large')) {
        errorMessage = error.message
        statusCode = 413
      } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
        errorMessage = 'Network error occurred. Please try again.'
        statusCode = 503
      } else if (errorMsg.includes('rate') || errorMsg.includes('429')) {
        errorMessage = 'Too many requests. Please try again later.'
        statusCode = 429
      }
    }
    
    if (!res.headersSent) {
      res.status(statusCode).json({ 
        error: errorMessage,
        timestamp: new Date().toISOString(),
        activeDownloads: activeDownloads,
        maxConcurrent: maxConcurrent
      })
    }
  }
}