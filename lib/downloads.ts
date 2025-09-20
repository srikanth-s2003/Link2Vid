// Simple downloads utility
export interface Download {
  id: string
  userId: string
  url: string
  title: string
  filename: string
  platform: string
  fileSize: string
  createdAt: Date
}

export async function saveDownload(download: Omit<Download, 'id' | 'createdAt'>) {
  // Placeholder - implement with your database
  return { id: Date.now().toString(), ...download, createdAt: new Date() }
}