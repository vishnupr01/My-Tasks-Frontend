'use client';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex items-center border border-green-900/50 rounded-sm bg-black focus-within:border-green-500 focus-within:shadow-[0_0_8px_rgba(34,197,94,0.15)] transition-all">
      <span className="pl-3 text-green-700 text-sm shrink-0">grep:</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="search_tasks..."
        className="flex-1 px-2 py-2 bg-transparent text-green-300 placeholder-green-900 text-sm outline-none font-mono"
      />
      {value && (
        <button onClick={() => onChange('')} className="pr-3 text-green-800 hover:text-green-500 transition-colors text-xs">
          [x]
        </button>
      )}
    </div>
  );
}
