import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

export default function Toast() {
  const { toast, clearToast } = useUiStore()
  if (!toast) return null

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  }

  const bg = {
    success: 'border-green-200 bg-green-50',
    error: 'border-red-200 bg-red-50',
    info: 'border-blue-200 bg-blue-50'
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${bg[toast.type]}`}>
        {icons[toast.type]}
        <p className="text-sm font-medium text-gray-800 flex-1">{toast.message}</p>
        <button onClick={clearToast} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
