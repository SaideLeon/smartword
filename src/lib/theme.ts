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
  ink:        '#0f0e0d',
  surface:    '#171412',
  surfaceAlt: '#1d1916',
  overlay:    '#171412',

  // Ouro — cor de destaque primária
  gold:       '#d4b37b',
  goldDark:   '#c9a96e',
  goldDim:    '#d4b37b22',
  goldFaint:  '#d4b37b11',

  // Texto
  textPrimary:  '#f1e8da',
  textSecondary:'#c8bfb4',
  textMuted:    '#8a7d6e',
  textFaint:    '#756858',
  textVeryFaint:'#665b4d',
  textDim:      '#7f7364',

  // Bordas
  borderStrong: '#2c2721',
  borderSubtle: '#211d19',

  // Estado — sucesso/verde (editor, exportação)
  green:       '#6ea886',
  greenBright: '#61aa9d',

  // Estado — erro
  errorBg:    '#3a0a0a',
  errorBorder:'#6a2020',
  errorText:  '#e07070',

  // Totalmente transparente (utilitário)
  transparent: 'transparent',
} as const;

// ─── Tema do painel TCC (verde escuro) ───────────────────────────────────────

export const tccTheme = {
  bg:         '#171412',
  surface:    '#1d1916',
  border:     '#2c2721',
  accent:     '#6ea886',
  accentDim:  '#6ea88644',
  accentFaint:'#6ea88611',
  muted:      '#c8bfb4',
  text:       '#f1e8da',
  textDim:    '#c8bfb4',
  textFaint:  '#8a7d6e',
  gold:       colors.gold,
  goldDim:    '#d4b37b33',
} as const;

// ─── Tema do painel Trabalho Escolar (teal) ───────────────────────────────────

export const workTheme = {
  bg:         '#171412',
  surface:    '#1d1916',
  border:     '#2c2721',
  accent:     '#61aa9d',
  accentDim:  '#61aa9d44',
  accentFaint:'#61aa9d11',
  muted:      '#c8bfb4',
  text:       '#f1e8da',
  textDim:    '#c8bfb4',
  textFaint:  '#8a7d6e',
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
  bg:         '#171412',
  surface:    '#1d1916',
  border:     colors.borderStrong,
  borderAlt:  colors.borderSubtle,
  accent:     colors.gold,
  accentDim:  colors.goldDim,
  text:       '#f1e8da',
  textMuted:  '#c8bfb4',
  textFaint:  '#8a7d6e',
  userBg:     '#28231f',
  assistantBg:'#1d1916',
} as const;

// ─── Gradientes ───────────────────────────────────────────────────────────────

export const gradients = {
  gold:        'linear-gradient(135deg, #d4b37b 0%, #c9a96e 100%)',
  goldHover:   'linear-gradient(135deg, #dcc08f 0%, #d2b27b 100%)',
  logoIcon:    'linear-gradient(135deg, #d4b37b 0%, #c9a96e 100%)',
  tccProgress: `linear-gradient(90deg, ${tccTheme.muted}, ${tccTheme.accent})`,
  workProgress:`linear-gradient(90deg, ${workTheme.muted}, ${workTheme.accent})`,
} as const;

// ─── Tipografia ───────────────────────────────────────────────────────────────

export const fonts = {
  serif:  "Georgia, 'Times New Roman', serif",
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
