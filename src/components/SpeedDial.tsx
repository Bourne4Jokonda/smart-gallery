import { useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, Download, Link, X, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const SpeedDial = () => {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  
  const actions = [
    {
      icon: <Brain className="h-5 w-5" />,
      label: "AI оценка",
      action: () => {
        // Выполнить запрос к API для оценки всех фото
        fetch('/api/all-photos-with-ai', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            console.log('AI оценка результата:', data)
            // Здесь можно обработать данные оценки
          })
          .catch(err => console.error('Ошибка AI оценки:', err))
      }
    },
    {
      icon: <Download className="h-5 w-5" />,
      label: "Скачать всё",
      action: () => {
        // Скачивание всех фото через существующий API
        window.open('/api/download-all', '_blank')
      }
    },
    {
      icon: <Link className="h-5 w-5" />,
      label: "Публичная ссылка",
      action: () => {
        // Копировать URL публичной галереи
        const currentUrl = window.location.href
        navigator.clipboard.writeText(currentUrl)
        console.log('Скопирована ссылка:', currentUrl)
      }
    },
  ]
  
  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Выпадающий список действий */}
      {isOpen && (
        <div className="mb-2 flex flex-col gap-2">
          {actions.map((item, index) => (
            <motion.button
              key={index}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
              onClick={() => {
                item.action()
                setIsOpen(false)
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {item.icon}
            </motion.button>
          ))}
        </div>
      )}
      
      {/* Основная кнопка speed dial */}
      <motion.button
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Sparkles className="h-6 w-6" />
        )}
      </motion.button>
    </div>
  )
}