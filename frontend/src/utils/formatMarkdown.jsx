/**
 * Zero-Leak Markdown Parser & Renderer for StockSee
 * Converts markdown (bold, italic, lists, code, headers, bullets) into React elements.
 * Guarantees that raw markdown syntax (like **, __, etc.) never leaks into the rendered output.
 */

const parseInlineTokens = (rawText, keyPrefix) => {
  if (!rawText) return null;

  // Replace any unclosed double asterisks or weird artifacts cleanly
  let text = rawText;

  // Regex matching **bold**, __bold__, *italic*, _italic_, and `code`
  const tokenRegex = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;
  const elements = [];
  let lastIdx = 0;
  let match;
  let count = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      // Clean any stray unmatched ** or __ from plain segment
      const plainSegment = text.substring(lastIdx, match.index).replace(/[*_]{2,}/g, '');
      if (plainSegment) elements.push(plainSegment);
    }

    const boldContent = match[2] || match[3];
    const italicContent = match[4] || match[5];
    const codeContent = match[6];

    if (boldContent) {
      elements.push(
        <strong key={`${keyPrefix}-b-${count++}`} className="rendered-strong">
          {boldContent}
        </strong>
      );
    } else if (italicContent) {
      elements.push(
        <em key={`${keyPrefix}-i-${count++}`} className="rendered-em">
          {italicContent}
        </em>
      );
    } else if (codeContent) {
      elements.push(
        <code key={`${keyPrefix}-c-${count++}`} className="rendered-code">
          {codeContent}
        </code>
      );
    }

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    const trailingSegment = text.substring(lastIdx).replace(/[*_]{2,}/g, '');
    if (trailingSegment) elements.push(trailingSegment);
  }

  return elements.length > 0 ? elements : text.replace(/[*_]{2,}/g, '');
};

export const renderMarkdown = (text) => {
  if (!text || typeof text !== 'string') return null;

  const rawLines = text.split('\n');
  const elements = [];

  // Normalize lines to join orphan bullets (e.g. "•\n**text**" -> "• **text**")
  const normalizedLines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i].trim();
    if ((cur === '•' || cur === '-' || cur === '*') && i + 1 < rawLines.length && rawLines[i + 1].trim()) {
      normalizedLines.push(`${cur} ${rawLines[i + 1].trim()}`);
      i++;
    } else {
      normalizedLines.push(cur);
    }
  }

  normalizedLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<div key={`spacer-${idx}`} className="rendered-spacer" />);
      return;
    }

    // Heading lines (e.g., "### Heading" or "## Heading")
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      elements.push(
        <div key={`h-${idx}`} className={`rendered-header h${level}`}>
          {parseInlineTokens(headerText, `h-${idx}`)}
        </div>
      );
      return;
    }

    // Numbered list item (e.g., "1. **ADANIPORTS** ...")
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={`num-${idx}`} className="rendered-list-item numbered">
          <span className="list-num-badge">{numMatch[1]}.</span>
          <span className="list-content">{parseInlineTokens(numMatch[2], `num-${idx}`)}</span>
        </div>
      );
      return;
    }

    // Bullet point line (e.g., "• **Latest Available Price**: ...")
    if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const cleanBullet = trimmed.replace(/^[-*•]\s*/, '');
      if (!cleanBullet.trim()) return;

      elements.push(
        <div key={`b-${idx}`} className="rendered-list-item bullet">
          <span className="list-bullet-symbol">•</span>
          <span className="list-content">{parseInlineTokens(cleanBullet, `b-${idx}`)}</span>
        </div>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${idx}`} className="rendered-paragraph">
        {parseInlineTokens(trimmed, `p-${idx}`)}
      </p>
    );
  });

  return <div className="rendered-markdown">{elements}</div>;
};

export default renderMarkdown;
