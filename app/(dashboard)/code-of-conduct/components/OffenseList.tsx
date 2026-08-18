import { Fragment } from "react";

interface OffenseListProps {
  examples: string[];
  query?: string;
}

function highlightMatch(text: string, query?: string) {
  const q = query?.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <Fragment>
      {text.slice(0, idx)}
      <mark className="bg-navy-100 text-navy-900 rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </Fragment>
  );
}

export function OffenseList({ examples, query }: OffenseListProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Example Offenses</p>
      <ul className="space-y-1.5">
        {examples.map((ex) => (
          <li key={ex} className="flex gap-2 text-sm text-gray-700 leading-snug">
            <span className="text-gray-300 select-none" aria-hidden="true">
              •
            </span>
            <span>{highlightMatch(ex, query)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
