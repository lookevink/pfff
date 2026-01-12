'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAppHotkeys } from '@/hooks/use-app-hotkeys'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function NewPasteButton() {
  const router = useRouter()

  const handleNewPaste = () => {
    router.push('/')
  }

  // Hotkey for new paste
  useAppHotkeys('alt+n', (e) => {
    e.preventDefault()
    handleNewPaste()
  })

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleNewPaste}
          >
            <Plus className="w-4 h-4" />
            New Paste
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Press <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"><span className="text-xs">⌥</span>N</kbd></p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
