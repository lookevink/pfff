'use client'

import { Button } from '@/components/ui/button'
import { Code, Eye, SplitSquareHorizontal } from 'lucide-react'

export type ViewMode = 'editor' | 'preview' | 'split'

interface ViewModeToggleProps {
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
  disabled?: boolean
}

export function ViewModeToggle({ mode, onModeChange, disabled = false }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-1">
      <Button
        type="button"
        variant={mode === 'editor' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('editor')}
        disabled={disabled}
        className="h-7 px-2 text-xs"
        title="Editor only (Ctrl+E)"
      >
        <Code className="w-3.5 h-3.5 mr-1" />
        Editor
      </Button>

      <Button
        type="button"
        variant={mode === 'preview' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('preview')}
        disabled={disabled}
        className="h-7 px-2 text-xs"
        title="Preview only (Ctrl+P)"
      >
        <Eye className="w-3.5 h-3.5 mr-1" />
        Preview
      </Button>

      <Button
        type="button"
        variant={mode === 'split' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('split')}
        disabled={disabled}
        className="h-7 px-2 text-xs"
        title="Split view (Ctrl+S)"
      >
        <SplitSquareHorizontal className="w-3.5 h-3.5 mr-1" />
        Split
      </Button>
    </div>
  )
}
