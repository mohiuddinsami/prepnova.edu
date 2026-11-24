import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

// Exportable utility to clean up leading option letters
export const stripOptionLetter = (text) => {
  if (typeof text !== 'string') return text;
  // Only strip A, B, C, D if they are followed by a dot, parenthesis, or space to prevent stripping letters from normal words like "Complex"
  return text.replace(/^[A-D][.)]?\s+/, '');
};

const fixBrokenMarkdownTables = (text) => {
  if (typeof text !== 'string') return text;
  
  // 0. Fix pasted literal \n strings to real newlines (so table rows and blocks separate cleanly)
  // Use negative lookahead to avoid breaking LaTeX commands starting with \n (like \nabla, \nu, \neq, \notin)
  let sanitized = text.replace(/\\n(?!abla|u|eq|e|otin|exists|eg|Rightarrow|Leftarrow|Leftrightarrow)/g, '\n');

  // 0.25. Add support for \dollar macro
  // Replace \dollar inside math blocks with \char36 (so KaTeX renders it as $)
  sanitized = sanitized.replace(/(?<!\\)(\$\$?)(.+?)(?<!\\)\1/g, (match, delim, inner) => {
    return delim + inner.replace(/\\+dollar/g, '\\char36 ') + delim;
  });
  // Replace any remaining \dollar (outside math blocks) with \$ (so Markdown renders it as $)
  sanitized = sanitized.replace(/\\+dollar/g, '\\$');

  // 0.3. Custom \underline{} macro
  // Intercept \underline{xyz} and convert to HTML <u> tag
  sanitized = sanitized.replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>');

  // 0.4. Fix squished \text{} blocks in math mode
  // The imported data sometimes generates \text{feet}\text{per}\text{minute} which KaTeX renders with no spaces.
  // We add a leading and trailing space INSIDE the \text{} block to force KaTeX to render the space.
  sanitized = sanitized.replace(/\\text\{([^}]+)\}/g, (match, inner) => {
    return `\\text{ ${inner.trim()} }`;
  });

  // 0.5. Fix malformed LaTeX degree symbols from imported data (\^{\circ} -> ^{\circ})
  sanitized = sanitized.replace(/\\\^\{\\circ\}/g, '^{\\circ}');
  sanitized = sanitized.replace(/\\\^\\circ/g, '^\\circ');

  // 0.6. Custom \indent macro for paragraph block indentation
  // Wraps the entire paragraph starting with \indent in a div with pl-[5%] (5% left padding)
  // This ensures the indentation lasts until the end of the paragraph (double newline)
  sanitized = sanitized.replace(/\\+indent\b\s*([\s\S]*?)(?=\n\n|$)/g, '<div class="pl-[5%]">\n\n$1\n\n</div>');

  // 1. Clean up multiple leading/trailing pipes on lines (e.g., || Only One ... -> | Only One ...)
  sanitized = sanitized.replace(/^[ \t]*\|{2,}/gm, '|');
  sanitized = sanitized.replace(/\|{2,}[ \t]*$/gm, '|');

  // 2. Split concatenated / squished delimiter and data rows
  // If delimiter row |---| is attached right after header row: | Header | |---|
  sanitized = sanitized.replace(/\|[ \t]*\|([ \t]*:?[-=]{2,})/g, '|\n|$1');
  // If data row is attached right after delimiter row: |---|---| | Data |
  sanitized = sanitized.replace(/([-=]{2,}:?[ \t]*\|)[ \t]*\|(?=[ \t]*[^|\s:=-])/g, '$1\n|');
  // If two data rows are joined across double or triple pipes on the same line: | 25% | || Mild |
  sanitized = sanitized.replace(/\|[ \t]*\|{2,}[ \t]*/g, '|\n|');

  // 3. Line-by-line Table Block Detection & Column Normalization
  // Ensures every table row has exact matching column count with header & delimiter so ReactMarkdown never drops cells.
  const lines = sanitized.split('\n');
  const processedLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if ((line.startsWith('|') || line.endsWith('|')) && (line.match(/\|/g) || []).length >= 2) {
      const tableLines = [];
      while (i < lines.length) {
        const tLine = lines[i].trim();
        if ((tLine.startsWith('|') || tLine.endsWith('|')) && (tLine.match(/\|/g) || []).length >= 2) {
          tableLines.push(tLine);
          i++;
        } else {
          break;
        }
      }

      // Ensure every line cleanly starts and ends with a pipe '|'
      const cleanTableLines = tableLines.map(l => {
        let cl = l;
        if (!cl.startsWith('|')) cl = '|' + cl;
        if (!cl.endsWith('|')) cl = cl + '|';
        return cl;
      });

      // Find delimiter row index if any
      let delimIdx = cleanTableLines.findIndex(l => /^\|[:\s|-]+\|$/.test(l));

      const getColCount = (l) => {
        return l.slice(1, -1).split('|').length;
      };

      const colCounts = cleanTableLines.map(getColCount);
      const maxCols = Math.max(...colCounts);

      // Rebuild rows to match exact maxCols so columns are never truncated by GFM specification
      for (let r = 0; r < cleanTableLines.length; r++) {
        const isDelim = r === delimIdx || /^\|[:\s|-]+\|$/.test(cleanTableLines[r]);
        const cols = getColCount(cleanTableLines[r]);
        if (cols < maxCols) {
          if (isDelim) {
            cleanTableLines[r] = '|' + Array(maxCols).fill('---').join('|') + '|';
          } else if (r === 0 && delimIdx === 1) {
            // Missing top-left header cell(s) (common when Column 1 has row labels like "No reluctance")
            const diff = maxCols - cols;
            cleanTableLines[r] = '|' + Array(diff).fill(' ').join('|') + cleanTableLines[r];
          } else {
            // Missing trailing cell(s)
            const diff = maxCols - cols;
            cleanTableLines[r] = cleanTableLines[r].slice(0, -1) + Array(diff).fill(' ').join('|') + '|';
          }
        }
      }

      // If no delimiter row found after row 0 but we have multiple rows, insert a valid GFM delimiter row
      if (delimIdx === -1 && cleanTableLines.length >= 2) {
        const cols = getColCount(cleanTableLines[0]);
        cleanTableLines.splice(1, 0, '|' + Array(cols).fill('---').join('|') + '|');
      }

      processedLines.push(...cleanTableLines);
    } else {
      processedLines.push(lines[i]);
      i++;
    }
  }

  sanitized = processedLines.join('\n');

  // 4. Format Table Titles: Text line preceding table turns into ##### caption
  sanitized = sanitized.replace(/(^|\n)([^|#\n][^|\n]{2,})[\r\n]+(?=\s*\|.*\|[\r\n]+\s*\|[:\s|-]+\|)/g, '$1##### $2\n\n');

  // 5. Force clean break after table ends so markdown engine separates subsequent paragraphs correctly
  sanitized = sanitized.replace(/(\|\s*[\r\n]+)([^\s|#\n][^\n]*)/g, (match, tableEnd, nextText) => {
    if (!nextText.trim().startsWith('|')) {
      return tableEnd.trimRight() + '\n\n' + nextText;
    }
    return match;
  });

  // 6. Convert single newlines on non-table lines to Markdown hard breaks (<br>)
  sanitized = sanitized.replace(/([^\n]) *\n(?!\n)(?!\s*\|)(?!\s*[:-])/g, '$1  \n');
  
  return sanitized;
};

const markdownComponents = {
  // 1. The main table structure
  table: ({node, ...props}) => (
    <div className="overflow-x-auto mb-6 last:mb-0 mt-0">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  // 2. The dark SAT-style header row
  th: ({node, ...props}) => (
    <th className="bg-gray-800 text-white font-semibold p-3 text-left border border-gray-700 align-top" {...props} />
  ),
  // 3. The standard data rows
  td: ({node, ...props}) => (
    <td className="border border-gray-700 p-3 align-top" {...props} />
  ),
  // 4. Custom Table Captions (Mapped from our H5 regex)
  h5: ({node, ...props}) => (
    <div className="text-center font-bold text-gray-800 mb-2 mt-8 text-base tracking-wide" {...props} />
  ),
  // 5. Clean up paragraph spacing
  p: ({node, ...props}) => (
    <p className="mb-4 last:mb-0" {...props} />
  ),
  // 6. Restore List Styling (Tailwind preflight strips this)
  ul: ({node, ...props}) => (
    <ul className="list-disc pl-8 mb-4 space-y-2" {...props} />
  ),
  ol: ({node, ...props}) => (
    <ol className="list-decimal pl-8 mb-4 space-y-2" {...props} />
  ),
  li: ({node, ...props}) => (
    <li className="pl-2" {...props} />
  ),
  // 4.5. Style the native underline tag
  u: ({node, ...props}) => (
    <u className="underline underline-offset-[3px] decoration-1 decoration-gray-800" {...props} />
  ),
  // 7. Render images cleanly, especially within option buttons
  img: ({node, ...props}) => (
    <img className="max-w-full h-auto object-contain rounded-md inline-block max-h-[35vh]" {...props} />
  )
};

function RichTextBase({ content }) {
  if (!content) return null;
  
  let processedContent = content.trim();
  let appendedImages = [];

  if (processedContent.includes(' || ')) {
    const parts = processedContent.split(' || ').map(p => p.trim());
    processedContent = parts[0];
    appendedImages = parts.slice(1);
  }
  
  // Auto-convert raw image URLs (like Supabase storage links) into Markdown images
  if (/^https?:\/\/[^\s]+$/.test(processedContent) && 
      (processedContent.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i) || processedContent.includes('/storage/v1/object/public/'))) {
    processedContent = `![](${processedContent})`;
  }

  const sanitizedContent = fixBrokenMarkdownTables(processedContent);

  return (
    <div className="w-full text-base leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={markdownComponents}
      >
        {sanitizedContent}
      </ReactMarkdown>
      {appendedImages.length > 0 && (
        <div className="mt-4 flex flex-col gap-4 items-center w-full">
          {appendedImages.map((imgUrl, idx) => (
            <img key={idx} src={imgUrl} alt={`Explanation figure ${idx + 1}`} className="max-w-full h-auto object-contain rounded-md border border-gray-200 shadow-sm" />
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(RichTextBase);
