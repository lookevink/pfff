import { notFound } from 'next/navigation'
import { PasteViewer } from '@/components/paste/paste-viewer'
import { NewPasteButton } from '@/components/paste/new-paste-button'
import { pasteService } from '@/lib/services/paste.service'
import { highlightCode } from '@/lib/highlighting/syntax-highlighter'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function PastePage({ params }: PageProps) {
  const { slug } = await params
  const paste = await pasteService.getPaste(slug)

  if (!paste) {
    notFound()
  }

  // Server-side syntax highlighting for fast initial render
  const highlighted = highlightCode(paste.content, paste.language)

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="max-w-4xl mx-auto mb-6">
        <NewPasteButton />
      </div>

      <PasteViewer
        slug={paste.slug}
        content={paste.content}
        language={paste.language}
        createdAt={paste.createdAt.toISOString()}
        expiresAt={paste.expiresAt?.toISOString() ?? null}
        viewCount={paste.viewCount}
        highlightedHtml={highlighted.html}
      />
    </div>
  )
}
