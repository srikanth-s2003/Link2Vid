# Overview

This is a Next.js-based video downloader application that allows users to download videos from various platforms (YouTube, Instagram, Facebook, Twitter/X, etc.) through a web interface. The application uses yt-dlp (via youtube-dl-exec) to handle video extraction and downloading, providing a simple frontend for users to paste video URLs and download content directly to their device.

## Recent Changes (September 20, 2025)
- Built complete Next.js TypeScript video downloader from scratch
- Implemented clean, minimal UI with TailwindCSS styling
- Created robust API endpoint with yt-dlp integration
- Added proper file streaming and automatic cleanup
- Configured development workflow on port 5000
- **SCALABILITY UPGRADE**: Enhanced application with production-ready features:
  - Rate limiting (5 downloads per 15 minutes per IP)
  - Concurrency control (max 3 simultaneous downloads)
  - Video caching system for repeat requests
  - Domain allowlisting for security
  - File size and duration limits
  - Enhanced error handling with retry mechanisms
  - Comprehensive timeouts and resource management
  - Improved frontend with download statistics and cache indicators

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Next.js 14 with React 18 using TypeScript
- **UI Framework**: Tailwind CSS for styling with a clean, minimal design
- **Client-Side Logic**: Single-page application with a form for URL input and download handling
- **File Download**: Browser-based download using Blob API and programmatic link creation

## Backend Architecture
- **API Structure**: Next.js API Routes pattern with a single `/api/download` endpoint
- **Video Processing**: Server-side video downloading using youtube-dl-exec (yt-dlp wrapper)
- **File Handling**: Temporary file storage in `/tmp` directory with automatic cleanup
- **Response Strategy**: Streaming file response directly to client without persistent storage

## Core Design Decisions
- **Port Configuration**: Application runs on port 5000 instead of default 3000
- **Download Strategy**: Server downloads video temporarily, then streams to client for immediate download
- **Quality Selection**: Downloads best available quality using yt-dlp's 'best' format option
- **Security**: Basic URL validation and method restriction (GET only) for the download endpoint
- **Error Handling**: Comprehensive error handling for invalid URLs, download failures, and cleanup operations

## File Management
- **Temporary Storage**: Uses system temp directory (`/tmp`) for intermediate file storage
- **Cleanup Strategy**: Automatic file deletion after streaming to prevent disk space issues
- **Filename Generation**: Timestamp-based unique filenames with video title extraction
- **Content Disposition**: Proper filename headers for browser download naming

# External Dependencies

## Core Dependencies
- **youtube-dl-exec**: YouTube video extraction and downloading capabilities
- **Next.js**: Full-stack React framework for both frontend and API backend
- **React/React-DOM**: Frontend UI library
- **Tailwind CSS**: Utility-first CSS framework for styling

## Development Tools
- **TypeScript**: Type safety and development experience
- **ESLint**: Code linting and formatting
- **PostCSS/Autoprefixer**: CSS processing and browser compatibility

## System Requirements
- **Node.js**: Runtime environment for server-side operations
- **File System Access**: Temporary file storage and cleanup capabilities
- **yt-dlp**: External binary dependency for video downloading (handled by youtube-dl-exec)