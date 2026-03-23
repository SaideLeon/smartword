# Implementação da Compressão de Contexto TCC

## Problema resolvido
Ao desenvolver um TCC longo, o contexto de todas as secções anteriores crescia linearmente, 
atingindo o limite da janela de tokens e impedindo concluir o trabalho.

## Solução implementada
Um agente de compressão automática que:
- Detecta quando há 3+ secções desenvolvidas fora do resumo
- Comprime as mais antigas num resumo denso de ~400 palavras
- Mantém sempre as 2 secções mais recentes completas (para continuidade directa)
- Guarda o resumo no Supabase para persistência entre sessões

## Ficheiros criados/modificados

### Novos ficheiros
```
supabase/migrations/002_context_compression.sql   ← executar no Supabase SQL Editor
lib/tcc/context-compressor.ts                     ← lógica central do agente compressor
app/api/tcc/compress/route.ts                     ← endpoint GET (status) e POST (forçar)
components/ContextCompressionBadge.tsx             ← indicador visual no painel
```

### Ficheiros substituídos
```
lib/tcc/types.ts          ← novos campos: context_summary, summary_covers_up_to, etc.
app/api/tcc/develop/route.ts  ← integra compressão automática antes de desenvolver
hooks/useTccSession.ts    ← expõe compressionStatus para a UI
components/TccPanel.tsx   ← badge de compressão + ícone ∑ nas secções comprimidas
```

## Setup

### 1. Executar a migração SQL
No Supabase SQL Editor, executar:
```sql
-- conteúdo de supabase/migrations/002_context_compression.sql
```

### 2. Substituir os ficheiros
Copiar cada ficheiro para o caminho correspondente no projecto.
Não são necessárias novas dependências — usa a infra-estrutura já existente.

## Como funciona (fluxo técnico)

```
Utilizador clica "✦" numa secção
          ↓
POST /api/tcc/develop
          ↓
compressContextIfNeeded(session, sectionIndex)
          ↓ 
analyseCompressionNeed()  →  shouldCompress?
   NÃO → continua normalmente
   SIM → gera resumo via IA (não-streaming, ~600 tokens max)
          ↓
saveCompressionResult() → Supabase
          ↓
buildOptimisedContext() → {outline + resumo + 2 secções recentes completas}
          ↓
System prompt com contexto optimizado → IA gera a secção
          ↓
Header X-Context-Compressed: true → UI mostra badge
```

## Limiares configuráveis (lib/tcc/context-compressor.ts)

| Constante                  | Valor | Significado                                      |
|---------------------------|-------|--------------------------------------------------|
| `COMPRESSION_THRESHOLD`    | 3     | Nº mínimo de secções não comprimidas para activar |
| `RECENT_SECTIONS_TO_KEEP`  | 2     | Nº de secções recentes sempre completas           |
| `max_tokens` (resumo)      | 600   | Limite do resumo gerado                          |
| `temperature` (resumo)     | 0.2   | Baixo para consistência                          |

## Indicadores visuais na UI

- **Badge `∑ Resumo activo · N chars`** no header do painel — aparece quando compressão já correu
- **Badge `✦ Contexto comprimido`** (dourado, com pulso) — aparece imediatamente após compressão
- **Ícone `∑`** discreto ao lado do título de cada secção já incluída no resumo
- **Mensagem inline** durante o desenvolvimento: "✦ Contexto comprimido automaticamente..."

## Endpoint de diagnóstico

```
GET /api/tcc/compress?sessionId=XXX&targetSection=N
```
Devolve:
```json
{
  "compressionActive": true,
  "summaryCoveredUpTo": 4,
  "summaryLength": 1243,
  "shouldCompress": false,
  "sectionsInSummary": 5,
  "sectionsStillFull": 2,
  "sectionsUncompressed": 2
}
```
