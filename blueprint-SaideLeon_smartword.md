Este é o **Technical Blueprint** para a evolução e escalabilidade da plataforma **Muneri**, consolidado sob a perspectiva de Arquitetura de Software e Liderança Técnica.

---

# 🏗️ Muneri: Technical Blueprint & Architectural Roadmap

## 1. Visão Geral do Projeto e Arquitetura

O Muneri não é apenas um editor de Markdown; é uma **engine de transformação de documentos acadêmicos**. O core business reside na ponte entre o mundo web (MathML/LaTeX) e o ecossistema Office (OMML).

### Arquitetura Proposta: "Feature-Based Modular Monolith"
Atualmente, o projeto tende a um modelo de "God Component". A proposta é migrar para uma arquitetura baseada em domínios funcionais dentro do diretório `src/`:

*   **Core (Editor):** Manipulação de Markdown e estados de escrita.
*   **Engine (Conversion):** O "cérebro" LaTeX → MathML → OMML.
*   **AI (Intelligence):** Camada de integração com Groq/LLMs.
*   **UI (Design System):** Componentes agnósticos de lógica.

---

## 2. Tech Stack & Dependências

| Camada | Tecnologia | Justificativa |
| :--- | :--- | :--- |
| **Framework** | Next.js 14+ (App Router) | SEO para landing pages e Server Actions para segurança. |
| **Linguagem** | TypeScript (Strict Mode) | Segurança de tipos na manipulação de estruturas AST de Markdown. |
| **Estado** | Zustand | Leve e performático para o estado global do editor vs. Context API. |
| **Estilização** | Tailwind CSS + Radix UI | Padronização, acessibilidade (a11y) e remoção de inline styles. |
| **Processamento** | Temml + Custom OMML Logic | Conversão matemática nativa sem dependência de imagens. |
| **IA** | Groq (Llama 3.3) | Baixíssima latência para streaming de texto acadêmico. |
| **PWA** | Serwist (ex-next-pwa) | Gerenciamento robusto de cache para uso offline em áreas remotas. |

---

## 3. Análise de Componentes e Estrutura

### Problema Identificado: O "God Component" (`app/app/page.tsx`)
O arquivo central acumula estado de interface, lógica de IA e renderização de editor.

### Decomposição Necessária:
1.  **`EditorContainer`**: Gerencia o input Markdown.
2.  **`PreviewPanel`**: Renderiza o output em tempo real.
3.  **`TccSidebar`**: Gerencia a árvore de estrutura do documento.
4.  **`AiAssistant`**: Interface de chat destacada da lógica do editor.
5.  **`ExportEngine`**: Serviço isolado para geração do `.docx`.

---

## 4. Estratégia de Refatoração (Passo a Passo)

### Fase 1: Desacoplamento de Estado (Semana 1)
*   Extrair todo o estado do `page.tsx` para um `useEditorStore` (Zustand).
*   Estados como `isAiOpen`, `content`, `currentStructure` devem ser globais.

### Fase 2: Migração de Estilos (Semana 2)
*   Substituir objetos de estilo inline por classes Tailwind.
*   Criar um `theme.config` para as cores acadêmicas (Bege/Dourado/Preto) para garantir consistência.

### Fase 3: Isolamento da Engine de Conversão (Semana 3)
*   Mover a lógica de LaTeX para OMML para uma `lib/conversion`.
*   Implementar testes unitários para garantir que fórmulas complexas não quebrem no Word.

### Fase 4: API & Segurança (Semana 4)
*   Mover chaves de API da Groq estritamente para Server Side (Environment Variables).
*   Implementar *Rate Limiting* nas rotas de chat para evitar custos inesperados.

---

## 5. Diretrizes de Implementação

1.  **Acessibilidade (a11y) como First-Class Citizen:**
    *   Todo elemento clicável deve ser um `<button>` ou `<a>`.
    *   Implementar `aria-live` para notificações de salvamento automático.
2.  **Performance de Renderização:**
    *   Usar `debounced` input para o processamento de Markdown para evitar gargalos na thread principal durante a escrita rápida.
3.  **Tipagem Estrita:**
    *   Proibido o uso de `any`. Interfaces obrigatórias para respostas da IA e estruturas de documentos.

---

## 6. Tarefas Explícitas para IA (Coding Assistant)

*   **Tarefa 1 (Zustand Setup):** "Crie um store do Zustand para gerenciar o conteúdo do editor, o estado dos painéis laterais (TCC, IA) e o histórico de desfazer/refazer."
*   **Tarefa 2 (Tailwind Conversion):** "Refatore os estilos inline deste objeto [COLAR OBJETO] para classes utilitárias do Tailwind CSS, mantendo a fidelidade visual acadêmica."
*   **Tarefa 3 (Component Split):** "Extraia a lógica do Chat de IA deste componente para um componente isolado chamado `AiChatDrawer`, utilizando Radix UI para o componente de Drawer/Dialog."
*   **Tarefa 4 (A11y Fix):** "Analise o arquivo `page.tsx` e substitua todas as `divs` com `onClick` por botões semânticos, adicionando `aria-labels` onde necessário."

---

## 7. Análise de Risco e Mitigação

| Risco | Impacto | Mitigação |
| :--- | :--- | :--- |
| **Latência da IA** | Médio | Implementar UI de *skeleton* e streaming de texto em tempo real. |
| **Corrupção de `.docx`** | Alto | Criar uma suite de testes de integração que valida o XML gerado contra o schema oficial da Microsoft (OOXML). |
| **Uso Offline Falho** | Médio | Testar Service Workers rigorosamente via Chrome DevTools (Network: Offline). |
| **Custo de API (Groq)** | Baixo/Médio | Implementar limites de tokens por usuário e cache de respostas comuns. |

---

### Conclusão do Lead Técnico
O Muneri tem um potencial disruptivo real no mercado acadêmico lusófono. A chave do sucesso técnico será a **transição de um "script funcional" para uma "plataforma estruturada"**. A refatoração proposta não só facilitará a manutenção, mas permitirá a inclusão de funcionalidades como referenciamento ABNT automático e colaboração em tempo real no futuro.