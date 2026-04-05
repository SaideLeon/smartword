import { useState, useRef, useEffect, useCallback, memo } from "react";

// ─── Paleta de syntax highlighting ───────────────────────────────────────────
const TOKEN_COLORS = {
  keyword:     "#c792ea",
  string:      "#c3e88d",
  comment:     "#546e7a",
  number:      "#f78c6c",
  function:    "#82aaff",
  operator:    "#89ddff",
  punctuation: "#89ddff",
  type:        "#ffcb6b",
  tag:         "#f07178",
  attr:        "#c792ea",
  plain:       "#d4cfca",
};

const KEYWORDS = {
  js: ["const","let","var","function","return","if","else","for","while","do","switch","case","break","continue","class","extends","new","this","typeof","instanceof","import","export","default","from","async","await","try","catch","finally","throw","null","undefined","true","false","of","in","delete","void","yield","super","static","get","set"],
  ts: ["const","let","var","function","return","if","else","for","while","do","switch","case","break","continue","class","extends","new","this","typeof","instanceof","import","export","default","from","async","await","try","catch","finally","throw","null","undefined","true","false","of","in","interface","type","enum","implements","abstract","public","private","protected","readonly","namespace","declare","as","is","keyof","infer","never","any","unknown","void","boolean","string","number","object","symbol"],
  py: ["def","return","if","elif","else","for","while","break","continue","class","import","from","as","try","except","finally","raise","with","pass","lambda","yield","in","not","and","or","is","None","True","False","global","nonlocal","del","assert","async","await","print","len","range","type","list","dict","set","tuple","int","str","float","bool"],
  java: ["public","private","protected","class","interface","extends","implements","new","return","if","else","for","while","do","switch","case","break","continue","try","catch","finally","throw","throws","static","final","abstract","void","boolean","int","long","double","float","char","byte","short","null","true","false","import","package","this","super","instanceof","enum"],
  go: ["func","return","if","else","for","range","switch","case","break","continue","var","const","type","struct","interface","package","import","go","defer","select","chan","map","make","new","nil","true","false","len","cap","append","copy","delete","close","panic","recover","print","println"],
  rust: ["fn","let","mut","return","if","else","for","while","loop","match","use","mod","pub","struct","enum","impl","trait","type","const","static","unsafe","async","await","move","ref","where","in","as","self","super","crate","true","false","Some","None","Ok","Err"],
  sql: ["SELECT","FROM","WHERE","JOIN","LEFT","RIGHT","INNER","OUTER","ON","AS","INSERT","INTO","VALUES","UPDATE","SET","DELETE","CREATE","TABLE","DROP","ALTER","INDEX","PRIMARY","KEY","FOREIGN","REFERENCES","NOT","NULL","DEFAULT","UNIQUE","AND","OR","IN","LIKE","ORDER","BY","GROUP","HAVING","LIMIT","OFFSET","DISTINCT","COUNT","SUM","AVG","MAX","MIN","CASE","WHEN","THEN","ELSE","END","WITH","UNION","ALL","BEGIN","COMMIT","ROLLBACK"],
};

function getLangKeywords(lang) {
  const map = {
    javascript:"js", js:"js", jsx:"js",
    typescript:"ts", ts:"ts", tsx:"ts",
    python:"py", py:"py",
    java:"java",
    go:"go", golang:"go",
    rust:"rs", rs:"rust",
    sql:"sql",
  };
  return KEYWORDS[map[lang?.toLowerCase()]] || KEYWORDS.js;
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────
function tokenizeLine(line, lang) {
  const tokens = [];
  const keywords = getLangKeywords(lang);
  let rem = line;

  while (rem.length > 0) {
    // Comentário de linha: //, #, --
    const commentM = rem.match(/^(\/\/[^\n]*|#[^\n]*|--[^\n]*)/);
    if (commentM) { tokens.push({ text: commentM[1], color: TOKEN_COLORS.comment }); break; }

    // Comentário de bloco /* ... */
    const blockComM = rem.match(/^(\/\*[\s\S]*?\*\/)/);
    if (blockComM) { tokens.push({ text: blockComM[1], color: TOKEN_COLORS.comment }); rem = rem.slice(blockComM[1].length); continue; }

    // Strings: " ' `
    const dqM = rem.match(/^("(?:\\.|[^"\\])*")/);
    if (dqM) { tokens.push({ text: dqM[1], color: TOKEN_COLORS.string }); rem = rem.slice(dqM[1].length); continue; }

    const sqM = rem.match(/^('(?:\\.|[^'\\])*')/);
    if (sqM) { tokens.push({ text: sqM[1], color: TOKEN_COLORS.string }); rem = rem.slice(sqM[1].length); continue; }

    const tlM = rem.match(/^(`(?:\\.|[^`\\])*`)/);
    if (tlM) { tokens.push({ text: tlM[1], color: TOKEN_COLORS.string }); rem = rem.slice(tlM[1].length); continue; }

    // Números (int, float, hex)
    const numM = rem.match(/^(0x[\da-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)/);
    if (numM) { tokens.push({ text: numM[1], color: TOKEN_COLORS.number }); rem = rem.slice(numM[1].length); continue; }

    // Palavras: keyword / type (PascalCase) / função / plain
    const wordM = rem.match(/^([A-Za-z_$][\w$]*)/);
    if (wordM) {
      const w = wordM[1];
      let color = TOKEN_COLORS.plain;
      if (keywords.includes(w)) color = TOKEN_COLORS.keyword;
      else if (/^[A-Z][a-zA-Z0-9]*$/.test(w)) color = TOKEN_COLORS.type;
      else if (rem[w.length] === "(") color = TOKEN_COLORS.function;
      tokens.push({ text: w, color });
      rem = rem.slice(w.length);
      continue;
    }

    // Operadores
    const opM = rem.match(/^([=!<>+\-*/%&|^~?@]+)/);
    if (opM) { tokens.push({ text: opM[1], color: TOKEN_COLORS.operator }); rem = rem.slice(opM[1].length); continue; }

    // Pontuação
    const punctM = rem.match(/^([{}()[\];:,.])/);
    if (punctM) { tokens.push({ text: punctM[1], color: TOKEN_COLORS.punctuation }); rem = rem.slice(1); continue; }

    // Fallback
    tokens.push({ text: rem[0], color: TOKEN_COLORS.plain });
    rem = rem.slice(1);
  }
  return tokens;
}

// ─── Bloco de código ──────────────────────────────────────────────────────────
const CodeBlock = memo(function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ margin: "10px 0", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2520", background: "#0d0b0a" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 12px", background: "#181412", borderBottom: "1px solid #2a2520" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#c9a96e", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {lang || "código"}
        </span>
        <button
          onClick={handleCopy}
          style={{ background: "none", border: `1px solid ${copied ? "#4a7c59" : "#2a2520"}`, borderRadius: 4, padding: "2px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: copied ? "#6a9e5f" : "#5a5248", cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { if (!copied) { e.currentTarget.style.borderColor = "#4a4540"; e.currentTarget.style.color = "#8a7d6e"; } }}
          onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = "#2a2520"; e.currentTarget.style.color = "#5a5248"; } }}
        >
          {copied ? "✓ copiado" : "copiar"}
        </button>
      </div>

      {/* Código com números de linha */}
      <div style={{ overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: "#2a2520 transparent" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
          <tbody>
            {lines.map((line, i) => {
              const tokens = tokenizeLine(line, lang);
              return (
                <tr key={i} style={{ lineHeight: "1.65" }}>
                  <td style={{
                    width: 40, minWidth: 40,
                    padding: "0 10px 0 14px",
                    textAlign: "right",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: "#3a3530",
                    userSelect: "none",
                    verticalAlign: "top",
                    borderRight: "1px solid #1a1714",
                    background: "#0a0908",
                  }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: "0 18px 0 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, whiteSpace: "pre", verticalAlign: "top" }}>
                    {tokens.length === 0
                      ? <span>&nbsp;</span>
                      : tokens.map((tok, ti) => <span key={ti} style={{ color: tok.color }}>{tok.text}</span>)
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// ─── Inline Markdown ──────────────────────────────────────────────────────────
function renderInline(text, kp = "") {
  const parts = [];
  const RE = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`\n]+)`|\[([^\]]+)\]\(([^)]+)\)|~~(.+?)~~)/g;
  let last = 0, match, i = 0;

  while ((match = RE.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={`${kp}t${i++}`}>{text.slice(last, match.index)}</span>);

    if (match[2] !== undefined) {
      parts.push(<strong key={`${kp}b${i++}`} style={{ color: "#f1e8da", fontWeight: 600 }}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={`${kp}em${i++}`} style={{ color: "#d4b37b", fontStyle: "italic" }}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      parts.push(
        <code key={`${kp}c${i++}`} style={{ background: "#1e1a16", border: "1px solid #2a2520", borderRadius: 4, padding: "1px 5px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.87em", color: "#ffcb6b" }}>
          {match[4]}
        </code>
      );
    } else if (match[5] !== undefined) {
      parts.push(<a key={`${kp}a${i++}`} href={match[6]} target="_blank" rel="noreferrer" style={{ color: "#82aaff", textDecoration: "underline", textUnderlineOffset: 2 }}>{match[5]}</a>);
    } else if (match[7] !== undefined) {
      parts.push(<s key={`${kp}s${i++}`} style={{ color: "#5a5248" }}>{match[7]}</s>);
    }
    last = RE.lastIndex;
  }
  if (last < text.length) parts.push(<span key={`${kp}tail`}>{text.slice(last)}</span>);
  return parts.length > 0 ? parts : [<span key={`${kp}e`}>{text}</span>];
}

// ─── Markdown renderer completo ───────────────────────────────────────────────
function MarkdownContent({ content, isStreaming }) {
  const blocks = [];
  const lines = content.split("\n");
  let i = 0, key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Bloco de código fenced ─────────────────────────────────
    const fenceM = line.match(/^```(\w*)/);
    if (fenceM) {
      const lang = fenceM[1] || "";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(<CodeBlock key={key++} lang={lang} code={codeLines.join("\n")} />);
      continue;
    }

    // ── Heading # ## ###
    const hM = line.match(/^(#{1,4})\s+(.+)/);
    if (hM) {
      const lvl = hM[1].length;
      const sizes = ["1.25em", "1.08em", "0.96em", "0.9em"];
      blocks.push(
        <div key={key++} style={{
          fontSize: sizes[lvl - 1],
          fontWeight: lvl <= 2 ? 700 : 600,
          color: lvl === 1 ? "#c9a96e" : lvl === 2 ? "#d4b37b" : "#f1e8da",
          margin: `${lvl <= 2 ? 14 : 10}px 0 6px`,
          fontFamily: lvl === 1 ? "'Crimson Pro', serif" : "'JetBrains Mono', monospace",
          fontStyle: lvl === 1 ? "italic" : "normal",
          letterSpacing: lvl > 1 ? "0.04em" : "0",
          borderBottom: lvl === 1 ? "1px solid #2a2520" : "none",
          paddingBottom: lvl === 1 ? 6 : 0,
          lineHeight: 1.3,
        }}>
          {renderInline(hM[2], `h${key}`)}
        </div>
      );
      i++;
      continue;
    }

    // ── Regra horizontal
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      blocks.push(<div key={key++} style={{ height: 1, background: "linear-gradient(90deg,transparent,#2a2520,transparent)", margin: "12px 0" }} />);
      i++;
      continue;
    }

    // ── Blockquote
    if (line.startsWith("> ")) {
      const qLines = [];
      while (i < lines.length && lines[i].startsWith("> ")) { qLines.push(lines[i].slice(2)); i++; }
      blocks.push(
        <div key={key++} style={{ borderLeft: "3px solid #c9a96e44", paddingLeft: 12, margin: "8px 0", color: "#8a7d6e", fontStyle: "italic", fontSize: "0.93em", lineHeight: 1.65 }}>
          {qLines.map((ql, qi) => <div key={qi}>{renderInline(ql, `bq${key}-${qi}`)}</div>)}
        </div>
      );
      continue;
    }

    // ── Lista não ordenada
    if (line.match(/^[\-\*\+]\s/)) {
      const items = [];
      const indent = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)[\-\*\+]\s(.+)/);
        if (!m) break;
        items.push({ text: m[2], depth: Math.floor(m[1].length / 2) });
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ margin: "8px 0", paddingLeft: 0, listStyle: "none" }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4, paddingLeft: item.depth * 16, lineHeight: 1.65 }}>
              <span style={{ color: "#c9a96e", flexShrink: 0, marginTop: "0.35em", fontSize: "0.65em" }}>◆</span>
              <span style={{ color: "#d4cfca" }}>{renderInline(item.text, `ul${key}-${ii}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ── Lista ordenada
    if (line.match(/^\d+\.\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++; }
      blocks.push(
        <ol key={key++} style={{ margin: "8px 0", paddingLeft: 0, listStyle: "none" }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 5, lineHeight: 1.65 }}>
              <span style={{ color: "#c9a96e", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, flexShrink: 0, minWidth: 18, marginTop: "0.3em", fontWeight: 600 }}>{ii + 1}.</span>
              <span style={{ color: "#d4cfca" }}>{renderInline(item, `ol${key}-${ii}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // ── Tabela GFM
    if (line.includes("|") && lines[i + 1]?.match(/^\|?[\s\-:|]+\|/)) {
      const headerCells = line.split("|").map(c => c.trim()).filter(Boolean);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) { rows.push(lines[i].split("|").map(c => c.trim()).filter(Boolean)); i++; }
      blocks.push(
        <div key={key++} style={{ overflowX: "auto", margin: "10px 0", borderRadius: 6, border: "1px solid #2a2520" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
            <thead>
              <tr>
                {headerCells.map((h, hi) => (
                  <th key={hi} style={{ padding: "7px 12px", background: "#181412", borderBottom: "1px solid #2a2520", color: "#c9a96e", fontWeight: 600, textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 1 ? "#0f0e0d" : "transparent" }}>
                  {headerCells.map((_, ci) => (
                    <td key={ci} style={{ padding: "6px 12px", borderBottom: "1px solid #1a1714", color: "#d4cfca", verticalAlign: "top" }}>{renderInline(row[ci] || "", `td${key}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // ── Linha vazia
    if (line.trim() === "") {
      if (blocks.length > 0) blocks.push(<div key={key++} style={{ height: 5 }} />);
      i++;
      continue;
    }

    // ── Parágrafo
    blocks.push(
      <p key={key++} style={{ margin: "2px 0", lineHeight: 1.75, color: "#d4cfca" }}>
        {renderInline(line, `p${key}`)}
      </p>
    );
    i++;
  }

  return (
    <div style={{ fontSize: 13, fontFamily: "system-ui, sans-serif" }}>
      {blocks}
      {isStreaming && (
        <span style={{ display: "inline-block", width: 2, height: 13, background: "#c9a96e", marginLeft: 2, verticalAlign: "middle", animation: "cursorBlink 1s steps(1) infinite" }} />
      )}
    </div>
  );
}

// ─── Sugestões ────────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Explica a fórmula de Bhaskara com exemplos",
  "Cria um script Python para ordenar uma lista",
  "Escreve uma função TypeScript com generics",
  "Explica Big O notation com exemplos de código",
  "Cria um resumo académico sobre as Guerras Mundiais",
];

// ─── SessionItem ──────────────────────────────────────────────────────────────
function SessionItem({ session, isActive, onResume, onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #1a1714", background: isActive ? "#1c1814" : hov ? "#141210" : "transparent", transition: "background 0.15s", cursor: "pointer" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ flex: 1, padding: "9px 12px", minWidth: 0 }} onClick={onResume}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: isActive ? "#c9a96e" : "#8a7d6e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>
          {session.title}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: "#3a3530", marginTop: 2 }}>
          {session.messages.length} msg · {new Date(session.updatedAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{ background: "none", border: "none", color: "#3a3530", cursor: "pointer", padding: "0 10px", fontSize: 14, transition: "color 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#c97070")}
        onMouseLeave={e => (e.currentTarget.style.color = "#3a3530")}
        title="Eliminar"
      >×</button>
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isStreaming }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 4, marginBottom: 18 }}>
      {/* Rótulo */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: isUser ? "row-reverse" : "row" }}>
        {!isUser && (
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg,#c9a96e,#8b6914)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#0f0e0d", fontWeight: 700, flexShrink: 0, boxShadow: "0 0 8px rgba(201,169,110,0.35)" }}>✦</div>
        )}
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: isUser ? "#6a9e5f" : "#c9a96e" }}>
          {isUser ? "Tu" : "Muneri IA"}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: "#3a3530" }}>
          {new Date(msg.timestamp).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* Bolha */}
      <div style={{
        maxWidth: "90%",
        padding: isUser ? "10px 14px" : "12px 16px",
        borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
        background: isUser ? "#1a2b1a" : "#141210",
        border: `1px solid ${isUser ? "#2a3f2a" : "#2a2520"}`,
        wordBreak: "break-word",
      }}>
        {isUser ? (
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, lineHeight: 1.65, color: "#c8e8c0", whiteSpace: "pre-wrap" }}>
            {msg.content}
          </span>
        ) : (
          <MarkdownContent content={msg.content} isStreaming={isStreaming} />
        )}
      </div>
    </div>
  );
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "muneri-chat-v2";
function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveSessions(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s.slice(0, 30))); }
  catch {}
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MuneroChatPanel() {
  const [sessions, setSessions] = useState(() => loadSessions());
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [copiedIdx, setCopiedIdx] = useState(null);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const persistSession = useCallback((id, msgs, existing) => {
    if (!msgs.length) return existing;
    const firstUser = msgs.find(m => m.role === "user");
    const title = firstUser ? firstUser.content.slice(0, 58) + (firstUser.content.length > 58 ? "…" : "") : "Nova conversa";
    const now = Date.now();
    const updated = { id, title, messages: msgs, createdAt: existing.find(s => s.id === id)?.createdAt ?? now, updatedAt: now };
    const next = [updated, ...existing.filter(s => s.id !== id)].slice(0, 30);
    saveSessions(next);
    return next;
  }, []);

  const startNew = useCallback(() => {
    if (messages.length > 0 && currentId) setSessions(prev => persistSession(currentId, messages, prev));
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setCurrentId(id);
    setMessages([]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [messages, currentId, persistSession]);

  const resumeSession = useCallback(session => {
    if (messages.length > 0 && currentId) setSessions(prev => persistSession(currentId, messages, prev));
    setCurrentId(session.id);
    setMessages(session.messages);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [messages, currentId, persistSession]);

  const deleteSession = useCallback(id => {
    setSessions(prev => { const next = prev.filter(s => s.id !== id); saveSessions(next); return next; });
    if (currentId === id) { setCurrentId(null); setMessages([]); }
  }, [currentId]);

  const copyMessage = useCallback((content, idx) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    });
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const sessId = currentId ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (!currentId) setCurrentId(sessId);

    const userMsg = { role: "user", content: text, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setMessages(prev => [...prev, { role: "assistant", content: "", timestamp: Date.now() }]);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "És um assistente académico do Muneri — plataforma para estudantes moçambicanos. Respondes em português europeu. Usa Markdown nas respostas: **negrito**, *itálico*, `código inline`, blocos ```linguagem ... ```, listas, tabelas, headings. Para código usa SEMPRE blocos com a linguagem correcta (```python, ```typescript, ```javascript, ```sql, etc.).",
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const fullContent = data.content?.map(b => b.type === "text" ? b.text : "").join("") ?? "";

      // Simula streaming caractere a caractere, respeitando blocos de código inteiros
      const chunks = fullContent.split(/(?<=\n)/);
      let displayed = "";
      for (let ci = 0; ci < chunks.length; ci++) {
        if (ctrl.signal.aborted) break;
        displayed += chunks[ci];
        const snap = displayed;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: snap, timestamp: Date.now() };
          return updated;
        });
        await new Promise(r => setTimeout(r, 20));
      }

      const finalMsgs = [...newMessages, { role: "assistant", content: fullContent, timestamp: Date.now() }];
      setMessages(finalMsgs);
      setSessions(prev => persistSession(sessId, finalMsgs, prev));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "⚠ Erro ao gerar resposta. Verifica a ligação e tenta novamente.", timestamp: Date.now() };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, streaming, currentId, persistSession]);

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const filtered = historySearch.trim()
    ? sessions.filter(s => s.title.toLowerCase().includes(historySearch.toLowerCase()) || s.messages.some(m => m.content.toLowerCase().includes(historySearch.toLowerCase())))
    : sessions;

  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }

        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 10px rgba(201,169,110,0.18)} 50%{box-shadow:0 0 22px rgba(201,169,110,0.45)} }
        @keyframes dotBounce { 0%,80%,100%{transform:translateY(0);opacity:0.3} 40%{transform:translateY(-5px);opacity:1} }

        .mc-root { font-family:'JetBrains Mono',monospace; background:#0a0908; color:#f1e8da; height:100vh; display:flex; overflow:hidden; }

        /* Histórico */
        .mc-hist { width:228px; flex-shrink:0; background:#070605; border-right:1px solid #1a1714; display:flex; flex-direction:column; overflow:hidden; }
        .mc-hist-hdr { padding:13px 12px 10px; border-bottom:1px solid #1a1714; display:flex; align-items:center; justify-content:space-between; }
        .mc-hist-srch { margin:8px 10px; padding:7px 10px; background:#0f0e0d; border:1px solid #2a2520; border-radius:5px; color:#f1e8da; font-family:'JetBrains Mono',monospace; font-size:10px; outline:none; transition:border-color 0.15s; width:calc(100% - 20px); }
        .mc-hist-srch:focus { border-color:#c9a96e44; }
        .mc-hist-srch::placeholder { color:#3a3530; }
        .mc-sessions { flex:1; overflow-y:auto; scrollbar-width:none; }
        .mc-sessions::-webkit-scrollbar { display:none; }

        /* Main */
        .mc-main { flex:1; display:flex; flex-direction:column; min-width:0; }
        .mc-header { padding:11px 16px; border-bottom:1px solid #1a1714; display:flex; align-items:center; gap:10px; flex-shrink:0; background:#080706; }
        .mc-logo { width:30px; height:30px; border-radius:6px; background:linear-gradient(135deg,#c9a96e,#8b6914); display:flex; align-items:center; justify-content:center; font-family:'Crimson Pro',serif; font-size:17px; color:#0a0908; font-weight:600; flex-shrink:0; animation:glowPulse 3s ease-in-out infinite; }
        .mc-title { font-family:'Crimson Pro',serif; font-size:15px; font-style:italic; color:#c9a96e; }
        .mc-sub { font-size:9px; color:#3a3530; letter-spacing:0.06em; text-transform:uppercase; }
        .mc-hdr-right { margin-left:auto; display:flex; align-items:center; gap:7px; }

        .mc-btn { background:none; border:1px solid #2a2520; border-radius:5px; color:#8a7d6e; font-family:'JetBrains Mono',monospace; font-size:10px; padding:4px 9px; cursor:pointer; transition:all 0.15s; }
        .mc-btn:hover { border-color:#c9a96e; color:#c9a96e; }

        .mc-status { width:6px; height:6px; border-radius:50%; background:#4a7c59; box-shadow:0 0 6px #4a7c5988; animation:glowPulse 2.5s ease-in-out infinite; }

        /* Mensagens */
        .mc-msgs { flex:1; overflow-y:auto; padding:20px 18px; scrollbar-width:thin; scrollbar-color:#2a2520 transparent; }
        .mc-msgs::-webkit-scrollbar { width:4px; }
        .mc-msgs::-webkit-scrollbar-thumb { background:#2a2520; border-radius:2px; }

        /* Empty state */
        .mc-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:14px; animation:fadeSlideIn 0.4s ease; }
        .mc-empty-ico { width:52px; height:52px; border-radius:12px; background:linear-gradient(135deg,#1a1714,#2a2520); border:1px solid #2a2520; display:flex; align-items:center; justify-content:center; font-size:22px; color:#c9a96e; }
        .mc-empty-ttl { font-family:'Crimson Pro',serif; font-size:20px; color:#c9a96e; font-style:italic; }
        .mc-empty-sub { font-size:10px; color:#5a5248; text-align:center; line-height:1.65; max-width:260px; }
        .mc-sugs { display:flex; flex-direction:column; gap:5px; width:100%; max-width:360px; }
        .mc-sug { background:#0f0e0d; border:1px solid #2a2520; border-radius:6px; padding:8px 11px; color:#8a7d6e; font-family:'JetBrains Mono',monospace; font-size:10px; text-align:left; cursor:pointer; transition:all 0.15s; line-height:1.45; }
        .mc-sug:hover { border-color:#c9a96e44; color:#c9a96e; background:#141210; }

        /* Indicador typing */
        .mc-typing { display:flex; gap:5px; align-items:center; padding:8px 0 10px 28px; }
        .mc-dot { width:5px; height:5px; border-radius:50%; background:#c9a96e; animation:dotBounce 1.2s ease-in-out infinite; }

        /* Botões de ação */
        .mc-copy-msg { background:none; border:1px solid #2a2520; border-radius:4px; padding:2px 8px; font-family:'JetBrains Mono',monospace; font-size:9px; color:#5a5248; cursor:pointer; transition:all 0.12s; }
        .mc-copy-msg:hover { border-color:#4a4540; color:#8a7d6e; }

        .mc-quick-bar { padding:7px 14px; border-top:1px solid #1a1714; flex-shrink:0; background:#080706; }
        .mc-copy-last { width:100%; padding:6px 12px; border-radius:6px; border:1px solid #2a2520; background:transparent; font-family:'JetBrains Mono',monospace; font-size:10px; color:#8a7d6e; cursor:pointer; transition:all 0.15s; text-align:left; }
        .mc-copy-last:hover { border-color:#4a4540; color:#c8bfb4; }

        /* Input */
        .mc-input-area { padding:10px 12px; border-top:1px solid #1a1714; display:flex; align-items:flex-end; gap:8px; flex-shrink:0; background:#080706; }
        .mc-textarea { flex:1; resize:none; background:#0f0e0d; border:1px solid #2a2520; border-radius:8px; padding:10px 12px; color:#f1e8da; font-family:'JetBrains Mono',monospace; font-size:11px; line-height:1.55; outline:none; transition:border-color 0.15s; caret-color:#c9a96e; max-height:120px; }
        .mc-textarea:focus { border-color:#c9a96e44; }
        .mc-textarea::placeholder { color:#3a3530; }

        .mc-send { width:38px; height:38px; border-radius:8px; border:none; cursor:pointer; font-size:15px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.15s; }
        .mc-send.idle { background:#1a1714; color:#3a3530; cursor:default; }
        .mc-send.ready { background:linear-gradient(135deg,#c9a96e,#8b6914); color:#0a0908; }
        .mc-send.ready:hover { filter:brightness(1.12); transform:translateY(-1px); }
        .mc-send.stop { background:#2d1515; color:#e07070; }
        .mc-send.stop:hover { background:#3a1818; }

        /* Scrollbar código */
        .mc-code-scroll::-webkit-scrollbar { height:4px; }
        .mc-code-scroll::-webkit-scrollbar-thumb { background:#2a2520; border-radius:2px; }
      `}</style>

      <div className="mc-root">
        {/* ── Histórico ─────────────────────────────────────────────────── */}
        <div className="mc-hist">
          <div className="mc-hist-hdr">
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "#c9a96e" }}>Histórico</span>
            <button className="mc-btn" style={{ fontSize: 9 }} onClick={startNew}>+ Nova</button>
          </div>
          <input className="mc-hist-srch" placeholder="Pesquisar…" value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
          <div className="mc-sessions">
            {filtered.length === 0 && (
              <div style={{ padding: "20px 12px", textAlign: "center", fontSize: 10, color: "#3a3530" }}>
                {historySearch ? "Sem resultados" : "Nenhuma conversa ainda"}
              </div>
            )}
            {filtered.map(s => (
              <SessionItem key={s.id} session={s} isActive={currentId === s.id} onResume={() => resumeSession(s)} onDelete={() => deleteSession(s.id)} />
            ))}
          </div>
        </div>

        {/* ── Chat principal ─────────────────────────────────────────────── */}
        <div className="mc-main">
          {/* Header */}
          <div className="mc-header">
            <div className="mc-logo">∂</div>
            <div>
              <div className="mc-title">Muneri Chat</div>
              <div className="mc-sub">Assistente académico</div>
            </div>
            <div className="mc-hdr-right">
              <div className="mc-status" title="Online" />
              {messages.length > 0 && <button className="mc-btn" onClick={startNew}>+ Nova conversa</button>}
            </div>
          </div>

          {/* Mensagens */}
          <div className="mc-msgs">
            {messages.length === 0 ? (
              <div className="mc-empty">
                <div className="mc-empty-ico">✦</div>
                <div className="mc-empty-ttl">Como posso ajudar?</div>
                <div className="mc-empty-sub">
                  Explico conceitos, escrevo e revejo código, crio exercícios — sempre em português.
                </div>
                <div className="mc-sugs">
                  {SUGGESTIONS.map(s => (
                    <button key={s} className="mc-sug" onClick={() => { setInput(s); inputRef.current?.focus(); }}>{s}</button>
                  ))}
                </div>
                {sessions.length > 0 && (
                  <button style={{ background: "none", border: "none", color: "#5a5248", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }} onClick={() => resumeSession(sessions[0])}>
                    ↩ Retomar última conversa
                  </button>
                )}
              </div>
            ) : (
              messages.map((msg, i) => {
                const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;
                return (
                  <div key={i} style={{ animation: "fadeSlideIn 0.22s ease" }}>
                    <MessageBubble msg={msg} isStreaming={isLastAssistant && streaming} />

                    {/* Typing indicator quando conteúdo ainda está vazio */}
                    {isLastAssistant && streaming && msg.content === "" && (
                      <div className="mc-typing">
                        {[0, 1, 2].map(d => <div key={d} className="mc-dot" style={{ animationDelay: `${d * 0.2}s` }} />)}
                      </div>
                    )}

                    {/* Botão copiar individual */}
                    {msg.role === "assistant" && !streaming && msg.content && (
                      <div style={{ display: "flex", gap: 5, marginTop: -10, marginBottom: 10, paddingLeft: 2 }}>
                        <button className="mc-copy-msg" onClick={() => copyMessage(msg.content, i)}>
                          {copiedIdx === i ? "✓ copiado" : "copiar markdown"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Barra de cópia rápida */}
          {lastAssistant && !streaming && (
            <div className="mc-quick-bar">
              <button className="mc-copy-last" onClick={() => copyMessage(lastAssistant.content, -1)}>
                {copiedIdx === -1 ? "✓ Copiado" : "📋 Copiar última resposta"}
              </button>
            </div>
          )}

          {/* Input */}
          <div className="mc-input-area">
            <textarea
              ref={inputRef}
              className="mc-textarea"
              rows={2}
              placeholder="Escreve a tua pergunta… (Enter para enviar · Shift+Enter nova linha)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className={`mc-send ${streaming ? "stop" : input.trim() ? "ready" : "idle"}`}
              onClick={streaming ? () => abortRef.current?.abort() : input.trim() ? send : undefined}
              title={streaming ? "Parar" : "Enviar"}
            >
              {streaming ? "■" : "↑"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
