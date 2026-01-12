import { HistoryPanel } from '@/components/paste/history-panel'
import { NewPasteButton } from '@/components/paste/new-paste-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { History, UserPlus } from 'lucide-react'

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6" />
            <h1 className="text-2xl font-bold">Paste History</h1>
          </div>
          <NewPasteButton />
        </div>

        {/* Signup CTA */}
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Unlock Unlimited History
            </CardTitle>
            <CardDescription>
              You're using local storage (limited to 50 pastes). Sign up to:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 mb-4 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Save unlimited pastes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Sync across all your devices</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Never lose your paste history</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Advanced search & organization</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Private pastes with password protection</span>
              </li>
            </ul>
            <Button className="w-full sm:w-auto">
              <UserPlus className="w-4 h-4 mr-2" />
              Sign Up Free
            </Button>
          </CardContent>
        </Card>

        {/* History Panel */}
        <Card>
          <CardContent className="pt-6">
            <HistoryPanel />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
