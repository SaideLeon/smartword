/**
 * theme.ts — Fonte única de verdade para cores e tokens de design do Muneri.
 *
 * USO:
 *   import { colors, tccTheme, workTheme, editorTheme } from '@/lib/theme';
 *
 * MIGRAÇÃO GRADUAL:
 *   Os painéis já usam objectos locais `C`. Substitui-os importando os temas
 *   correspondentes daqui, um ficheiro de cada vez.
 */

// ─── Paleta global ────────────────────────────────────────────────────────────

export const colors = {
  // Fundos
  ink:        '#0f0e0d',   // fundo principal da app
  surface:    '#1a1714',   // superfícies (inputs, cards)
  surfaceAlt: '#141210',   // variante mais escura (editor textarea)
  overlay:    '#0d0c0b',   // painéis laterais (chat IA)

  // Ouro — cor de destaque primária
  gold:       '#c9a96e',
  goldDark:   '#8b6914',
  goldDim:    '#c9a96e22',
  goldFaint:  '#c9a96e11',

  // Texto
  textPrimary:  '#e8e2d9',   // texto principal
  textSecondary:'#d4cec7',   // texto secundário (editor)
  textMuted:    '#8a7d6e',   // legendas, labels
  textFaint:    '#5a5248',   // placeholder, decorativo
  textVeryFaint:'#4a4440',   // quase invisível
  textDim:      '#3a3530',   // contador de linhas, footer

  // Bordas
  borderStrong: '#2a2520',   // bordas principais
  borderSubtle: '#1e1b18',   // bordas secundárias / separadores

  // Estado — sucesso/verde (editor, exportação)
  green:       '#4a7c59',
  greenBright: '#6a9e5f',    // usado no TCC

  // Estado — erro
  errorBg:    '#3a0a0a',
  errorBorder:'#6a2020',
  errorText:  '#e07070',

  // Totalmente transparente (utilitário)
  transparent: 'transparent',
} as const;

// ─── Tema do painel TCC (verde escuro) ───────────────────────────────────────

export const tccTheme = {
  bg:         '#0b0d0b',
  surface:    '#111411',
  border:     '#1e2a1e',
  accent:     '#6a9e5f',
  accentDim:  '#6a9e5f44',
  accentFaint:'#6a9e5f11',
  muted:      '#4a6644',
  text:       '#d0dcc8',
  textDim:    '#7a9272',
  textFaint:  '#3a4e36',
  gold:       colors.gold,
  goldDim:    '#c9a96e33',
} as const;

// ─── Tema do painel Trabalho Escolar (teal) ───────────────────────────────────

export const workTheme = {
  bg:         '#0a0d0a',
  surface:    '#111611',
  border:     '#1a2a1a',
  accent:     '#5a9e8f',
  accentDim:  '#5a9e8f44',
  accentFaint:'#5a9e8f11',
  muted:      '#3a6e60',
  text:       '#c8dcd6',
  textDim:    '#6a9e90',
  textFaint:  '#2a4e44',
  gold:       colors.gold,
} as const;

// ─── Tema do editor / app principal ───────────────────────────────────────────

export const editorTheme = {
  bg:            colors.ink,
  surface:       colors.surface,
  surfaceAlt:    colors.surfaceAlt,
  border:        colors.borderStrong,
  borderSubtle:  colors.borderSubtle,
  text:          colors.textPrimary,
  textMuted:     colors.textMuted,
  textFaint:     colors.textFaint,
  gold:          colors.gold,
  goldDark:      colors.goldDark,
  goldDim:       colors.goldDim,
  green:         colors.green,
  caretColor:    colors.gold,
} as const;

// ─── Tema do chat IA (ouro/escuro) ────────────────────────────────────────────

export const chatTheme = {
  bg:         '#0d0c0b',
  surface:    '#141210',
  border:     colors.borderStrong,
  borderAlt:  colors.borderSubtle,
  accent:     colors.gold,
  accentDim:  colors.goldDim,
  text:       '#d4cec7',
  textMuted:  '#8a7d6e',
  textFaint:  '#4a4440',
  userBg:     '#1e1b18',
  assistantBg:'#141210',
} as const;

// ─── Gradientes ───────────────────────────────────────────────────────────────

export const gradients = {
  gold:        'linear-gradient(135deg, #c9a96e 0%, #8b6914 100%)',
  goldHover:   'linear-gradient(135deg, #d4b47a 0%, #9a7820 100%)',
  logoIcon:    'linear-gradient(135deg, #c9a96e 0%, #8b6914 100%)',
  tccProgress: `linear-gradient(90deg, ${tccTheme.muted}, ${tccTheme.accent})`,
  workProgress:`linear-gradient(90deg, ${workTheme.muted}, ${workTheme.accent})`,
} as const;

// ─── Tipografia ───────────────────────────────────────────────────────────────

export const fonts = {
  serif:  "'Georgia', 'Times New Roman', serif",
  mono:   "'Courier New', 'Courier', monospace",
  label:  'monospace',  // usado em labels, badges, botões
} as const;

// ─── Tamanhos de fonte comuns ─────────────────────────────────────────────────

export const fontSizes = {
  xs:   '10px',
  sm:   '11px',
  base: '12px',
  md:   '13px',
  lg:   '14px',
  xl:   '15px',
} as const;

// ─── Espaçamentos de layout ───────────────────────────────────────────────────

export const spacing = {
  panelPadding:       '1rem',
  panelPaddingMobile: '0.85rem',
  headerHeight:       '64px',
} as const;

// ─── Utilitários: gera string de cor com opacidade hex ───────────────────────

/**
 * Adiciona opacidade hexadecimal a uma cor hex de 6 dígitos.
 * @example withAlpha('#c9a96e', '44') → '#c9a96e44'
 */
export function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

/**
 * Estilos reutilizáveis para botões de ghost (apenas ícone, sem fundo).
 * Devolve um objecto React.CSSProperties.
 */
export function ghostButtonStyle(color: string): React.CSSProperties {
  return {
    background: 'none',
    border:     'none',
    color,
    cursor:     'pointer',
    fontSize:   '18px',
    lineHeight: 1,
    padding:    '2px 6px',
    borderRadius: '3px',
  };
}

/**
 * Estilos reutilizáveis para botões pequenos quadrados (ações inline nas secções).
 */
export function smallSquareButtonStyle(color: string): React.CSSProperties {
  return {
    width:          28,
    height:         28,
    borderRadius:   '4px',
    border:         `1px solid ${color}44`,
    background:     'transparent',
    color,
    fontFamily:     'monospace',
    fontSize:       '13px',
    cursor:         'pointer',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    transition:     'all 0.15s',
  };
}
