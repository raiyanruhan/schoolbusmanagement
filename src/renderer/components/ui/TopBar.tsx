import { useNavigate } from 'react-router-dom'
import { Settings, ArrowLeft } from 'lucide-react'

interface TopBarProps {
  showBack?: boolean
  backTo?: string
  backLabel?: string
  title?: string
  right?: React.ReactNode
}

export default function TopBar({ showBack, backTo = '/', backLabel = 'Back', title, right }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => navigate(backTo)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </button>
        )}
        {title && <h1 className="text-lg font-semibold text-gray-800">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <button
          onClick={() => navigate('/settings')}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
