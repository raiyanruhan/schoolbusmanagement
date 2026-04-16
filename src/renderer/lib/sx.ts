/**
 * Converts Primer-style `sx` prop objects to React CSSProperties.
 * Resolves Primer color tokens → CSS custom properties.
 * Resolves Primer spacing/fontSize/borderRadius scales → px values.
 * Pseudo-selectors (&:hover etc.) are silently ignored — use CSS utility
 * classes in globals.css for those (hov-bg-subtle, last-no-border, etc.)
 */
import type { CSSProperties } from 'react'

// Primer spacing scale (index → px)
const SPACE = [0, 4, 8, 16, 24, 32, 40, 48, 64]
// Primer font-size scale (index → px)
const FONT_SIZES = [12, 14, 16, 20, 24, 32, 40, 48]
// Primer border-radius scale (index → px or string)
const RADII: (number | string)[] = [0, 3, 6, 8, 12, 20, 30, 9999]

const FONT_WEIGHTS: Record<string, string> = {
  light: '300', normal: '400', medium: '500', semibold: '600', bold: '700',
}

// ── Color token maps ──────────────────────────────────────────────────────────

const BG: Record<string, string> = {
  'canvas.default':       'var(--bgColor-default)',
  'canvas.subtle':        'var(--bgColor-muted)',
  'canvas.inset':         'var(--bgColor-inset)',
  'accent.emphasis':      'var(--bgColor-accent-emphasis)',
  'accent.subtle':        'var(--bgColor-accent-muted)',
  'danger.emphasis':      'var(--bgColor-danger-emphasis)',
  'danger.subtle':        'var(--bgColor-danger-muted)',
  'danger.muted':         'var(--bgColor-danger-muted)',
  'success.emphasis':     'var(--bgColor-success-emphasis)',
  'success.subtle':       'var(--bgColor-success-muted)',
  'attention.emphasis':   'var(--bgColor-attention-emphasis)',
  'attention.subtle':     'var(--bgColor-attention-muted)',
  'done.emphasis':        'var(--bgColor-done-emphasis)',
  'done.subtle':          'var(--bgColor-done-muted)',
  'sponsors.emphasis':    'var(--bgColor-sponsors-emphasis)',
  'sponsors.subtle':      'var(--bgColor-sponsors-muted)',
  'neutral.subtle':       'var(--bgColor-neutral-subtle)',
  'neutral.emphasis':     'var(--bgColor-neutral-emphasis)',
  'neutral.muted':        'var(--bgColor-neutral-muted, rgba(0,0,0,0.06))',
  'transparent':          'transparent',
}

const FG: Record<string, string> = {
  'fg.default':           'var(--fgColor-default)',
  'fg.muted':             'var(--fgColor-muted)',
  'fg.subtle':            'var(--fgColor-subtle)',
  'fg.onEmphasis':        'var(--fgColor-onEmphasis)',
  'accent.fg':            'var(--fgColor-accent)',
  'danger.fg':            'var(--fgColor-danger)',
  'success.fg':           'var(--fgColor-success)',
  'attention.fg':         'var(--fgColor-attention)',
  'done.fg':              'var(--fgColor-done)',
  'sponsors.fg':          'var(--fgColor-sponsors)',
  'neutral.fg':           'var(--fgColor-neutral)',
}

const BORDER_COL: Record<string, string> = {
  'border.default':           'var(--borderColor-default)',
  'border.muted':             'var(--borderColor-muted)',
  'border.subtle':            'var(--borderColor-subtle)',
  'accent.emphasis':          'var(--borderColor-accent-emphasis)',
  'accent.muted':             'var(--borderColor-accent-muted)',
  'danger.emphasis':          'var(--borderColor-danger-emphasis)',
  'danger.muted':             'var(--borderColor-danger-muted)',
  'success.emphasis':         'var(--borderColor-success-emphasis)',
  'attention.emphasis':       'var(--borderColor-attention-emphasis)',
  'attention.muted':          'var(--borderColor-attention-muted)',
  'done.emphasis':            'var(--borderColor-done-emphasis)',
  'transparent':              'transparent',
}

// ── Resolvers ─────────────────────────────────────────────────────────────────

function sp(v: number | string | undefined): string | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'number') return `${SPACE[v] ?? v}px`
  return v
}

function rBg(v: string): string  { return BG[v]        ?? v }
function rFg(v: string): string  { return FG[v]        ?? v }
function rBc(v: string): string  { return BORDER_COL[v] ?? v }

function rRadius(v: number | string | undefined): string | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'number') {
    const r = RADII[v]
    return r !== undefined ? `${r}px` : `${v}px`
  }
  return v
}

function rFontSize(v: number | string): string {
  if (typeof v === 'number' && v < FONT_SIZES.length) return `${FONT_SIZES[v]}px`
  if (typeof v === 'number') return `${v}px`
  return v
}

function rFontWeight(v: string | number): string {
  if (typeof v === 'string' && FONT_WEIGHTS[v]) return FONT_WEIGHTS[v]
  return String(v)
}

function rSize(v: number | string): string {
  if (typeof v === 'number') return `${v}px`
  return v
}

// ── Main converter ────────────────────────────────────────────────────────────

export function sx(input: Record<string, unknown> = {}): CSSProperties {
  const css: CSSProperties = {}

  for (const [key, rawVal] of Object.entries(input)) {
    if (rawVal === undefined || rawVal === null || key.startsWith('&')) continue
    const v = rawVal as string | number

    switch (key) {
      // Background
      case 'bg':              css.background = rBg(String(v));  break
      case 'backgroundColor': css.backgroundColor = rBg(String(v)); break

      // Color
      case 'color':           css.color = rFg(String(v)); break

      // Padding
      case 'p':  css.padding      = sp(v); break
      case 'px': css.paddingLeft  = sp(v); css.paddingRight  = sp(v); break
      case 'py': css.paddingTop   = sp(v); css.paddingBottom = sp(v); break
      case 'pt': css.paddingTop    = sp(v); break
      case 'pb': css.paddingBottom = sp(v); break
      case 'pl': css.paddingLeft   = sp(v); break
      case 'pr': css.paddingRight  = sp(v); break
      case 'padding':        css.padding        = sp(v); break
      case 'paddingTop':     css.paddingTop     = sp(v); break
      case 'paddingBottom':  css.paddingBottom  = sp(v); break
      case 'paddingLeft':    css.paddingLeft    = sp(v); break
      case 'paddingRight':   css.paddingRight   = sp(v); break

      // Margin
      case 'm':  css.margin       = sp(v); break
      case 'mx': css.marginLeft   = sp(v); css.marginRight  = sp(v); break
      case 'my': css.marginTop    = sp(v); css.marginBottom = sp(v); break
      case 'mt': css.marginTop    = sp(v); break
      case 'mb': css.marginBottom = sp(v); break
      case 'ml': css.marginLeft   = sp(v); break
      case 'mr': css.marginRight  = sp(v); break

      // Gap
      case 'gap':       css.gap       = sp(v); break
      case 'rowGap':    css.rowGap    = sp(v); break
      case 'columnGap': css.columnGap = sp(v); break

      // Flex / Grid layout
      case 'display':        css.display        = v as CSSProperties['display']; break
      case 'flex':           css.flex           = String(v); break
      case 'flexDirection':  css.flexDirection  = v as CSSProperties['flexDirection']; break
      case 'flexWrap':       css.flexWrap       = v as CSSProperties['flexWrap']; break
      case 'flexShrink':     css.flexShrink     = Number(v); break
      case 'flexGrow':       css.flexGrow       = Number(v); break
      case 'alignItems':     css.alignItems     = v as CSSProperties['alignItems']; break
      case 'alignSelf':      css.alignSelf      = v as CSSProperties['alignSelf']; break
      case 'justifyContent': css.justifyContent = v as CSSProperties['justifyContent']; break
      case 'gridTemplateColumns': css.gridTemplateColumns = String(v); break
      case 'gridTemplateRows':    css.gridTemplateRows    = String(v); break
      case 'gridColumn':     css.gridColumn     = String(v); break
      case 'gridRow':        css.gridRow        = String(v); break

      // Dimensions
      case 'width':     css.width     = rSize(v); break
      case 'height':    css.height    = rSize(v); break
      case 'minWidth':  css.minWidth  = rSize(v); break
      case 'minHeight': css.minHeight = rSize(v); break
      case 'maxWidth':  css.maxWidth  = rSize(v); break
      case 'maxHeight': css.maxHeight = rSize(v); break

      // Border
      case 'border':        css.border        = String(v); break
      case 'borderTop':     css.borderTop     = String(v); break
      case 'borderBottom':  css.borderBottom  = String(v); break
      case 'borderLeft':    css.borderLeft    = String(v); break
      case 'borderRight':   css.borderRight   = String(v); break
      case 'borderColor':      css.borderColor      = rBc(String(v)); break
      case 'borderTopColor':   css.borderTopColor   = rBc(String(v)); break
      case 'borderBottomColor':css.borderBottomColor= rBc(String(v)); break
      case 'borderLeftColor':  css.borderLeftColor  = rBc(String(v)); break
      case 'borderRightColor': css.borderRightColor = rBc(String(v)); break
      case 'borderRadius':   css.borderRadius   = rRadius(v); break
      case 'borderWidth':    css.borderWidth    = rSize(v); break
      case 'borderStyle':    css.borderStyle    = v as CSSProperties['borderStyle']; break
      case 'borderCollapse': css.borderCollapse = v as CSSProperties['borderCollapse']; break

      // Typography
      case 'fontSize':      css.fontSize      = rFontSize(v); break
      case 'fontWeight':    css.fontWeight    = rFontWeight(v); break
      case 'fontFamily':    css.fontFamily    = String(v); break
      case 'lineHeight':    css.lineHeight    = String(v); break
      case 'letterSpacing': css.letterSpacing = typeof v === 'string' ? v : `${v}em`; break
      case 'textAlign':     css.textAlign     = v as CSSProperties['textAlign']; break
      case 'textDecoration':css.textDecoration= String(v); break
      case 'textTransform': css.textTransform = v as CSSProperties['textTransform']; break
      case 'textOverflow':  css.textOverflow  = v as CSSProperties['textOverflow']; break
      case 'whiteSpace':    css.whiteSpace    = v as CSSProperties['whiteSpace']; break
      case 'wordBreak':     css.wordBreak     = v as CSSProperties['wordBreak']; break
      case 'fontStyle':     css.fontStyle     = v as CSSProperties['fontStyle']; break

      // Overflow
      case 'overflow':  css.overflow  = v as CSSProperties['overflow']; break
      case 'overflowX': css.overflowX = v as CSSProperties['overflowX']; break
      case 'overflowY': css.overflowY = v as CSSProperties['overflowY']; break

      // Position
      case 'position': css.position = v as CSSProperties['position']; break
      case 'top':      css.top      = sp(v); break
      case 'bottom':   css.bottom   = sp(v); break
      case 'left':     css.left     = sp(v); break
      case 'right':    css.right    = sp(v); break
      case 'zIndex':   css.zIndex   = Number(v); break

      // Visual
      case 'opacity':       css.opacity       = Number(v); break
      case 'cursor':        css.cursor        = v as CSSProperties['cursor']; break
      case 'transform':     css.transform     = String(v); break
      case 'transition':    css.transition    = String(v); break
      case 'boxShadow':     css.boxShadow     = String(v); break
      case 'resize':        css.resize        = v as CSSProperties['resize']; break
      case 'listStyle':     css.listStyle     = String(v); break
      case 'objectFit':     css.objectFit     = v as CSSProperties['objectFit']; break
      case 'pointerEvents': css.pointerEvents = v as CSSProperties['pointerEvents']; break
      case 'userSelect':    css.userSelect    = v as CSSProperties['userSelect']; break
      case 'visibility':    css.visibility    = v as CSSProperties['visibility']; break
      case 'verticalAlign': css.verticalAlign = String(v); break

      default: break // silently skip unknown keys and pseudo-selectors
    }
  }

  return css
}
