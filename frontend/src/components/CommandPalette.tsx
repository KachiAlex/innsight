import React, { useEffect, useState, useRef } from 'react';
import { Search, X } from 'lucide-react';

export interface Command {
  id: string;
  title: string;
  description?: string;
  category: string;
  action: () => void;
  icon?: React.ReactNode;
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

/**
 * Command Palette - Navigate and execute actions with Cmd+K
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Filter commands based on query
  const filteredCommands = React.useMemo(() => {
    if (!query.trim()) return commands;
    return commands.filter(cmd =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, commands]);

  // Group commands by category
  const groupedCommands = React.useMemo(() => {
    const grouped = new Map<string, Command[]>();
    filteredCommands.forEach(cmd => {
      if (!grouped.has(cmd.category)) {
        grouped.set(cmd.category, []);
      }
      grouped.get(cmd.category)!.push(cmd);
    });
    return grouped;
  }, [filteredCommands]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const totalCommands = filteredCommands.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(Math.min(selectedIndex + 1, totalCommands - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(Math.max(selectedIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 50,
        }}
        onClick={onClose}
      />

      {/* Command Palette */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
          zIndex: 51,
          width: '90%',
          maxWidth: '600px',
          maxHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInScale 0.2s ease-out',
        }}
      >
        {/* Search Input */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={20} style={{ color: '#94a3b8' }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search commands..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '1rem',
                color: '#1e293b',
              }}
            />
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Commands List */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '0.5rem 0',
          }}
        >
          {groupedCommands.size === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#94a3b8',
              }}
            >
              No commands found
            </div>
          ) : (
            Array.from(groupedCommands.entries()).map(([category, cmds]) => (
              <div key={category}>
                {/* Category Header */}
                <div
                  style={{
                    padding: '0.5rem 1rem 0.25rem',
                    color: '#94a3b8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {category}
                </div>

                {/* Category Commands */}
                {cmds.map((cmd, idx) => {
                  const globalIndex = Array.from(groupedCommands.values())
                    .slice(0, Array.from(groupedCommands.keys()).indexOf(category))
                    .reduce((sum, g) => sum + g.length, 0) + idx;

                  return (
                    <div
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        background: globalIndex === selectedIndex ? '#f1f5f9' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      onMouseLeave={() => setSelectedIndex(-1)}
                    >
                      {cmd.icon && (
                        <div style={{ color: '#64748b' }}>
                          {cmd.icon}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#1e293b', fontWeight: 500 }}>
                          {cmd.title}
                        </div>
                        {cmd.description && (
                          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <div
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#e2e8f0',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#64748b',
                            fontFamily: 'monospace',
                          }}
                        >
                          {cmd.shortcut}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '1rem',
            fontSize: '0.75rem',
            color: '#94a3b8',
          }}
        >
          <span>↑ ↓ to navigate</span>
          <span>⏎ to execute</span>
          <span>esc to close</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
};
