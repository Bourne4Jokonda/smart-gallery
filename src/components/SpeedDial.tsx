import { useState } from 'react'
import { 
  Brain, 
  Download, 
  Trash2, 
  X, 
  Sparkles, 
  Copy, 
  MessageSquareText 
} from 'lucide-react'
import { toast } from 'sonner'

interface SpeedDialProps {
  shootId: string
  hasAiResults?: boolean
  publicUrl?: string
  loading?: {
    curate: boolean
    describe: boolean
    download: boolean
    deleteAll: boolean
  }
  onCurate: () => void
  onDescribeAll: () => void
  onDownloadZip: () => void
  onDeleteAll: () => void
}

export const SpeedDial = ({
  shootId,
  hasAiResults = false,
  publicUrl,
  loading = { curate: false, describe: false, download: false, deleteAll: false },
  onCurate,
  onDescribeAll,
  onDownloadZip,
  onDeleteAll,
}: SpeedDialProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const actions = [
    {
      icon: loading.curate ? (
        <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : <Brain className="h-5 w-5" />,
      label: hasAiResults ? "Перезапустить AI-отбор" : "AI-отбор",
      onClick: onCurate,
      disabled: loading.curate,
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      icon: loading.describe ? (
        <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : <MessageSquareText className="h-5 w-5" />,
      label: "AI-описание",
      onClick: onDescribeAll,
      disabled: loading.describe,
      color: "bg-cyan-500 hover:bg-cyan-600",
    },
    {
      icon: loading.download ? (
        <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : <Download className="h-5 w-5" />,
      label: "Скачать ZIP",
      onClick: onDownloadZip,
      disabled: loading.download,
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      icon: <Copy className="h-5 w-5" />,
      label: "Публичная ссылка",
      onClick: () => {
        if (publicUrl) {
          navigator.clipboard.writeText(publicUrl)
          toast.success("Ссылка скопирована")
        }
      },
      disabled: !publicUrl,
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      icon: loading.deleteAll ? (
        <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : <Trash2 className="h-5 w-5" />,
      label: "Удалить всё",
      onClick: () => {
        if (confirm(`Удалить ВСЕ фото сессии ${shootId.slice(-6)}? Это необратимо.`)) {
          onDeleteAll()
        }
      },
      disabled: loading.deleteAll,
      color: "bg-red-500 hover:bg-red-600",
    },
  ]

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Action buttons - positioned ABOVE main button, expanding UP */}
      <div
        className={
          "absolute bottom-full right-0 mb-2 flex flex-col-reverse items-end gap-2 transition-all duration-200" +
          (isOpen ? " scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0")
        }
      >
        {actions.map((action) => (
          <div key={action.label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!action.disabled) {
                  action.onClick()
                  setIsOpen(false)
                }
              }}
              disabled={action.disabled}
              className={
                "inline-flex items-center justify-end gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-bold text-foreground transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 w-[190px] h-[2.5rem]" +
                (isOpen ? " shadow-md" : " shadow-none")
              }
            >
              <span className="text-xs">{action.label}</span>
              <span className="text-primary">{action.icon}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Main button - always at bottom */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
    </div>
  )
}
