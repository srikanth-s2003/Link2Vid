#!/bin/bash

# Vercel build script to install yt-dlp
echo "Installing yt-dlp for Vercel deployment..."

# Create bin directory
mkdir -p /tmp

# Download yt-dlp binary
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /tmp/yt-dlp
chmod +x /tmp/yt-dlp

# Verify installation
/tmp/yt-dlp --version

echo "yt-dlp installation complete"