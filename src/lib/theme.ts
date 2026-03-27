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
  ink:        '#131313',
  surface:    '#1c1c1c',
  surfaceAlt: '#232323',
  overlay:    '#1c1c1c',

  // Ouro — cor de destaque primária
  gold:       '#f59e0b',
  goldDark:   '#f97316',
  goldDim:    '#f59e0b22',
  goldFaint:  '#f59e0b11',

  // Texto
  textPrimary:  '#e8e8e8',
  textSecondary:'#9a9a9a',
  textMuted:    '#606060',
  textFaint:    '#4f4f4f',
  textVeryFaint:'#404040',
  textDim:      '#505050',

  // Bordas
  borderStrong: '#2f2f2f',
  borderSubtle: '#252525',

  // Estado — sucesso/verde (editor, exportação)
  green:       '#00d6a0',
  greenBright: '#00d6a0',

  // Estado — erro
  errorBg:    '#3a0a0a',
  errorBorder:'#6a2020',
  errorText:  '#e07070',

  // Totalmente transparente (utilitário)
  transparent: 'transparent',
} as const;

// ─── Tema do painel TCC (verde escuro) ───────────────────────────────────────

export const tccTheme = {
  bg:         '#1c1c1c',
  surface:    '#232323',
  border:     '#2f2f2f',
  accent:     '#00d6a0',
  accentDim:  '#00d6a044',
  accentFaint:'#00d6a011',
  muted:      '#9a9a9a',
  text:       '#e8e8e8',
  textDim:    '#9a9a9a',
  textFaint:  '#606060',
  gold:       colors.gold,
  goldDim:    '#f59e0b33',
} as const;

// ─── Tema do painel Trabalho Escolar (teal) ───────────────────────────────────

export const workTheme = {
  bg:         '#1c1c1c',
  surface:    '#232323',
  border:     '#2f2f2f',
  accent:     '#00d6a0',
  accentDim:  '#00d6a044',
  accentFaint:'#00d6a011',
  muted:      '#9a9a9a',
  text:       '#e8e8e8',
  textDim:    '#9a9a9a',
  textFaint:  '#606060',
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
  bg:         '#1c1c1c',
  surface:    '#232323',
  border:     colors.borderStrong,
  borderAlt:  colors.borderSubtle,
  accent:     colors.gold,
  accentDim:  colors.goldDim,
  text:       '#e8e8e8',
  textMuted:  '#9a9a9a',
  textFaint:  '#606060',
  userBg:     '#2c2c2c',
  assistantBg:'#232323',
} as const;

// ─── Gradientes ───────────────────────────────────────────────────────────────

export const gradients = {
  gold:        'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  goldHover:   'linear-gradient(135deg, #f7ac2a 0%, #fb8b36 100%)',
  logoIcon:    'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  tccProgress: `linear-gradient(90deg, ${tccTheme.muted}, ${tccTheme.accent})`,
  workProgress:`linear-gradient(90deg, ${workTheme.muted}, ${workTheme.accent})`,
} as const;

// ─── Tipografia ───────────────────────────────────────────────────────────────

export const fonts = {
  serif:  "'Manrope', sans-serif",
  mono:   "'JetBrains Mono', monospace",
  label:  "'JetBrains Mono', monospace",
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
