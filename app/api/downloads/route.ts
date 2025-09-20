import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Here you would fetch downloads from your database
    // For now, return empty array
    const downloads: any[] = []

    return NextResponse.json(downloads)
  } catch (error) {
    console.error('Downloads API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { url, title, filename } = await request.json()

    if (!url || !title || !filename) {
      return NextResponse.json(
        { error: 'URL, title, and filename are required' },
        { status: 400 }
      )
    }

    // Here you would save the download to your database
    const download = {
      id: Date.now().toString(),
      userId: session.user.id,
      url,
      title,
      filename,
      createdAt: new Date(),
    }

    return NextResponse.json(download, { status: 201 })
  } catch (error) {
    console.error('Downloads POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}