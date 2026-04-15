import { useNavigate } from 'react-router-dom'
import { Settings, ArrowLeft } from 'lucide-react'
import { Box, Button, Heading, IconButton } from '@primer/react'

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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 4,
        py: 3,
        borderBottom: '1px solid',
        borderColor: 'border.default',
        bg: 'canvas.default',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {showBack && (
          <Button
            variant="invisible"
            size="small"
            leadingVisual={ArrowLeft}
            onClick={() => navigate(backTo)}
            sx={{ color: 'fg.muted' }}
          >
            {backLabel}
          </Button>
        )}
        {title && (
          <Heading as="h1" sx={{ fontSize: 2, fontWeight: 'semibold', color: 'fg.default' }}>
            {title}
          </Heading>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {right}
        <IconButton
          icon={Settings}
          aria-label="Settings"
          variant="invisible"
          onClick={() => navigate('/settings')}
          sx={{ color: 'fg.muted' }}
        />
      </Box>
    </Box>
  )
}
