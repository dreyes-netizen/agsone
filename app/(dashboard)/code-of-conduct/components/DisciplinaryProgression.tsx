import type { CodeOfConduct } from "@/lib/settings/codeOfConduct";

interface DisciplinaryProgressionProps {
  steps: CodeOfConduct["tiers"][number]["steps"];
}

export function DisciplinaryProgression({ steps }: DisciplinaryProgressionProps) {
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Disciplinary Progression</p>
      <ol className="space-y-0">
        {sorted.map((s, i) => (
          <li key={s.order} className="relative pl-8 pb-4 last:pb-0">
            {i < sorted.length - 1 && (
              <span className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200" aria-hidden="true" />
            )}
            <span
              className="absolute left-0 top-0.5 flex items-center justify-center w-[22px] h-[22px] rounded-full bg-gray-100 text-gray-700 text-[11px] font-semibold tabular-nums"
              aria-hidden="true"
            >
              {s.order}
            </span>
            <p className="text-sm text-gray-700 leading-snug">{s.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
