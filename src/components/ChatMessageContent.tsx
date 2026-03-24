'use client';

import { Fragment, useMemo, type ElementType, type ReactNode } from 'react';
import temml from 'temml';
import { parseToAST } from '@/lib/docx/parser';
import type { DocumentNode, InlineNode } from '@/lib/docx/types';

interface Props {
  content: string;
  role: 'user' | 'assistant';
}

export function ChatMessageContent({ content, role }: Props) {
  const documentNodes = useMemo(() => parseToAST(content), [content]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
        color: role === 'user' ? '#e4ddd5' : '#d8d0c7',
        fontFamily: role === 'user' ? "'Georgia', serif" : "'Courier New', monospace",
        fontSize: '12px',
        lineHeight: 1.75,
      }}
    >
      {documentNodes.length > 0
        ? documentNodes.map((node, index) => <BlockNodeView key={index} node={node} role={role} />)
        : <ParagraphFallback content={content} />}
    </div>
  );
}

function BlockNodeView({ node, role }: { node: DocumentNode; role: 'user' | 'assistant' }) {
  switch (node.type) {
    case 'paragraph':
      return <p style={{ margin: 0 }}>{renderInlineNodes(node.children, role)}</p>;
    case 'heading': {
      const sizeMap: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
        1: '1.2rem',
        2: '1.05rem',
        3: '0.98rem',
        4: '0.92rem',
        5: '0.88rem',
        6: '0.84rem',
      };

      const HeadingTag = `h${node.level}` as ElementType;

      return (
        <HeadingTag
          style={{
            margin: 0,
            fontSize: sizeMap[node.level],
            lineHeight: 1.35,
            color: '#f0e7dc',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            fontFamily: "'Georgia', serif",
          }}
        >
          {renderInlineNodes(node.children, role)}
        </HeadingTag>
      );
    }
    case 'list': {
      const ListTag = (node.ordered ? 'ol' : 'ul') as 'ol' | 'ul';

      return (
        <ListTag
          style={{
            margin: 0,
            paddingLeft: '1.25rem',
            display: 'grid',
            gap: '0.45rem',
          }}
        >
          {node.items.map((item, index) => (
            <li key={index} style={{ paddingLeft: '0.15rem' }}>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {item.map((child, childIndex) => (
                  <BlockNodeView key={childIndex} node={child} role={role} />
                ))}
              </div>
            </li>
          ))}
        </ListTag>
      );
    }
    case 'blockquote':
      return (
        <blockquote
          style={{
            margin: 0,
            padding: '0.75rem 0.9rem',
            borderLeft: '3px solid #c9a96e55',
            background: '#171411',
            borderRadius: '0 8px 8px 0',
            display: 'grid',
            gap: '0.55rem',
            color: '#cfc6bc',
          }}
        >
          {node.children.map((child, index) => (
            <BlockNodeView key={index} node={child} role={role} />
          ))}
        </blockquote>
      );
    case 'math_block':
      return <MathBlock latex={node.latex} displayMode />;
    default:
      return null;
  }
}

function ParagraphFallback({ content }: { content: string }) {
  return (
    <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {content}
    </p>
  );
}

function renderInlineNodes(nodes: InlineNode[], role: 'user' | 'assistant'): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;

    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.value}</Fragment>;
      case 'strong':
        return <strong key={key} style={{ color: '#f2eadf', fontWeight: 700 }}>{renderInlineNodes(node.children, role)}</strong>;
      case 'emphasis':
        return <em key={key} style={{ color: '#d8be90' }}>{renderInlineNodes(node.children, role)}</em>;
      case 'inline_code':
        return (
          <code
            key={key}
            style={{
              background: '#191613',
              border: '1px solid #2d2721',
              borderRadius: '5px',
              padding: '0.12rem 0.4rem',
              color: '#d8be90',
              fontSize: '0.95em',
              fontFamily: "'Courier New', monospace",
            }}
          >
            {node.value}
          </code>
        );
      case 'link':
        return (
          <a
            key={key}
            href={node.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#d8be90', textDecoration: 'underline', textUnderlineOffset: '0.2em' }}
          >
            {renderInlineNodes(node.children, role)}
          </a>
        );
      case 'math_inline':
        return <MathBlock key={key} latex={node.latex} displayMode={false} inlineRole={role} />;
      default:
        return null;
    }
  });
}

function MathBlock({
  latex,
  displayMode,
  inlineRole,
}: {
  latex: string;
  displayMode: boolean;
  inlineRole?: 'user' | 'assistant';
}) {
  const mathMarkup = useMemo(() => {
    try {
      return temml.renderToString(latex, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return null;
    }
  }, [displayMode, latex]);

  if (!mathMarkup) {
    return (
      <code
        style={{
          display: displayMode ? 'block' : 'inline-block',
          whiteSpace: 'pre-wrap',
          background: '#161311',
          border: '1px solid #3a2d24',
          borderRadius: '6px',
          padding: displayMode ? '0.75rem 0.9rem' : '0.1rem 0.4rem',
          color: '#e4b87f',
          fontFamily: "'Courier New', monospace",
        }}
      >
        {latex}
      </code>
    );
  }

  return (
    <span
      style={{
        display: displayMode ? 'block' : 'inline-flex',
        width: displayMode ? '100%' : 'auto',
        overflowX: displayMode ? 'auto' : 'visible',
        padding: displayMode ? '0.9rem 1rem' : '0 0.18rem',
        borderRadius: '8px',
        border: displayMode ? '1px solid #2a2520' : 'none',
        background: displayMode ? '#15120f' : 'transparent',
        color: inlineRole === 'user' ? '#efe6da' : '#f3eadc',
        alignItems: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: mathMarkup }}
    />
  );
}
