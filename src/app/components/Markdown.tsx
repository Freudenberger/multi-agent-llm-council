import React from "react";
import type { ReactNode } from "react";

/**
 * Minimal markdown renderer — no external deps.
 * Supports: paragraphs, headings (h1-h3), bold, italic, links,
 * inline code, code blocks, blockquotes, lists (ul/ol), hr, tables.
 */
export function Markdown({ content }: { content: string }): ReactNode {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  let i = 0;

  const flushParagraph = (buf: string[], key: number) => {
    const text = buf.join("\n").trim();
    if (!text) return;
    elements.push(
      <p key={key} className="mb-3 last:mb-0">
        {renderInline(text)}
      </p>,
    );
  };

  const isTableRow = (line: string): boolean =>
    line.trim().startsWith("|") && line.trim().endsWith("|");

  const parseTable = (tableLines: string[], key: number) => {
    const rows = tableLines.map((line) =>
      line
        .split("|")
        .slice(1, -1) // remove empty first/last from leading/trailing |
        .map((cell) => cell.trim()),
    );
    // First row is header, second is separator (skip it), rest are data
    const headerCells = rows[0];
    const dataRows = rows.slice(2); // skip header + separator

    return (
      <div
        key={key}
        className="overflow-x-auto mb-3 rounded-lg border border-zinc-200 dark:border-zinc-700"
      >
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800/60">
              {headerCells.map((cell, ci) => (
                <th
                  key={ci}
                  className="px-3 py-2 text-left font-semibold text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 whitespace-nowrap"
                >
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr
                key={ri}
                className="even:bg-zinc-50 dark:even:bg-zinc-800/20 hover:bg-blue-50 dark:hover:bg-zinc-800/40 transition-colors"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2 align-top text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800/70"
                  >
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const parseList = (
    listLines: string[],
    ordered: boolean,
    key: number,
  ) => {
    const Tag = ordered ? "ol" : "ul";
    const items = listLines.map((line, idx) => {
      const content = line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
      return (
        <li key={idx} className="[&>p]:mb-0">
          {renderInline(content)}
        </li>
      );
    });
    return (
      <Tag
        key={key}
        className={`mb-3 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}
      >
        {items}
      </Tag>
    );
  };

  let paraBuf: string[] = [];
  let listBuf: string[] = [];
  let listOrdered = false;
  let tableBuf: string[] = [];
  let blockKey = 0;

  const flushList = () => {
    if (listBuf.length > 0) {
      elements.push(parseList(listBuf, listOrdered, blockKey++));
      listBuf = [];
    }
  };

  const flushPara = () => {
    if (paraBuf.length > 0) {
      flushParagraph(paraBuf, blockKey++);
      paraBuf = [];
    }
  };

  const flushTable = () => {
    if (tableBuf.length >= 3) {
      // Need at least header + separator + 1 data row
      elements.push(parseTable(tableBuf, blockKey++));
    } else if (tableBuf.length > 0) {
      // Not enough rows for a table — render as paragraphs
      tableBuf.forEach((line) => paraBuf.push(line));
      flushPara();
    }
    tableBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushPara();
      flushList();
      flushTable();
      elements.push(<hr key={blockKey++} className="border-zinc-700 my-4" />);
      i++;
      continue;
    }

    // Table row
    if (isTableRow(line)) {
      // If we were building a paragraph or list, flush them first
      flushPara();
      flushList();
      tableBuf.push(line);
      i++;
      continue;
    } else if (tableBuf.length > 0) {
      // Non-table line after table rows — flush the table
      flushTable();
    }

    // Headings
    const hMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (hMatch) {
      flushPara();
      flushList();
      const level = hMatch[1].length;
      const text = hMatch[2];
      const sizeClass =
        level === 1
          ? "text-xl font-bold"
          : level === 2
            ? "text-lg font-semibold"
            : "text-base font-semibold";
      const headingClass = `${sizeClass} mt-4 mb-2`;
      if (level === 1) {
        elements.push(<h1 key={blockKey++} className={headingClass}>{renderInline(text)}</h1>);
      } else if (level === 2) {
        elements.push(<h2 key={blockKey++} className={headingClass}>{renderInline(text)}</h2>);
      } else {
        elements.push(<h3 key={blockKey++} className={headingClass}>{renderInline(text)}</h3>);
      }
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      flushPara();
      flushList();
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      elements.push(
        <blockquote
          key={blockKey++}
          className="border-l-4 border-zinc-600 pl-4 py-1 mb-3 text-zinc-400 italic"
        >
          {quoteLines.map((ql, qi) => (
            <p key={qi} className="mb-1 last:mb-0">
              {renderInline(ql)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Code block
    if (line.startsWith("```")) {
      flushPara();
      flushList();
      const codeLines: string[] = [];
      i++; // skip opening ```
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre
          key={blockKey++}
          className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 mb-3 overflow-x-auto text-sm font-mono text-zinc-300"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // List item
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
    if (ulMatch || olMatch) {
      flushPara();
      const ordered = !!olMatch;
      if (listBuf.length > 0 && listOrdered !== ordered) {
        flushList();
      }
      listOrdered = ordered;
      listBuf.push(line);
      i++;
      continue;
    }

    // Empty line — flush paragraph
    if (line.trim() === "") {
      flushPara();
      flushList();
      i++;
      continue;
    }

    // Regular paragraph line
    if (listBuf.length > 0) flushList();
    paraBuf.push(line);
    i++;
  }

  flushPara();
  flushList();
  flushTable();

  return <div className="markdown-content">{elements}</div>;
}

/**
 * Renders a single line of inline markdown (bold, italic, inline code, links)
 * without any surrounding block element. Use this for content that already
 * lives inside a block — e.g. `<li>` items in the Final Synthesis Report —
 * where the full `Markdown` block renderer would wrap text in `<p>`/`<div>`.
 */
export function InlineMarkdown({ content }: { content: string }): ReactNode {
  return <>{renderInline(content)}</>;
}

/** Render inline markdown: bold, italic, inline code, links */
function renderInline(text: string): ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Regex matches: bold **...**, italic *...*, inline code `...`, links [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      nodes.push(
        <strong key={key++} className="font-semibold text-zinc-100">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      // Italic
      nodes.push(
        <em key={key++} className="italic text-zinc-300">
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      // Inline code
      nodes.push(
        <code
          key={key++}
          className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-sm font-mono"
        >
          {match[4]}
        </code>,
      );
    } else if (match[5]) {
      // Link
      nodes.push(
        <a
          key={key++}
          href={match[6]}
          className="text-blue-400 hover:text-blue-300 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[5]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
