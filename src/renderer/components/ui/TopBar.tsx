import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Slash } from 'lucide-react';
import { Button, IconButton } from '@primer/react';

interface TopBarProps {
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
  title?: string;
  subtitle?: string;        // Added for better hierarchy
  right?: React.ReactNode;
  showSettings?: boolean;
  onSettingsClick?: () => void;
}

export default function TopBar({
  showBack = false,
  backTo = '/',
  backLabel = 'Back',
  title,
}: TopBarProps) {
  const navigate = useNavigate();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',                    // Fixed height for density
        padding: '0 20px',
        borderBottom: '1px solid var(--borderColor-default)',
        background: 'var(--bgColor-default)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left Section */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        minWidth: 0,           // Allows truncation
      }}>
        {showBack && (
          <Button
            variant="invisible"
            size="small"
            leadingVisual={ArrowLeft}
            onClick={() => navigate(backTo)}
            sx={{
              color: 'fg.muted',
              padding: '4px 8px',
              fontSize: '16px',
              fontWeight: 400,
              minHeight: 'auto',
              '&:hover': { backgroundColor: 'var(--bgColor-muted)' }
            }}
          >
            {backLabel}
          </Button>
        )}
                          <Button
            variant="invisible"
            size="small"
            leadingVisual={Slash}
            sx={{
              color: 'fg.muted',
              padding: '4px 8px',
              fontSize: '16px',
              fontWeight: 400,
              minHeight: 'auto',
              '&:hover': { backgroundColor: 'transparent' },
              cursor: 'default'
            }}
          >
          </Button>
                  <Button
            variant="invisible"
            size="small"
            sx={{
              color: 'fg.muted',
              padding: '4px 8px',
              fontSize: '16px',
              fontWeight: 400,
              minHeight: 'auto',
              cursor: 'default',
              '&:hover': { backgroundColor: 'transparent' }
            }}
          >
            {title}
          </Button>
      </div>
    </header>
  );
}