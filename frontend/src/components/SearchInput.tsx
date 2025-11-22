import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export default function SearchInput({ value, onChange, placeholder = 'Search...', style }: SearchInputProps) {
  return (
    <div style={{ position: 'relative', maxWidth: '400px', ...style }}>
      <Search
        size={20}
        style={{
          position: 'absolute',
          left: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#94a3b8',
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.75rem 0.75rem 0.75rem 2.5rem',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          fontSize: '0.875rem',
        }}
      />
    </div>
  );
}

