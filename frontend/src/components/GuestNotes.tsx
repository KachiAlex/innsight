import { useState } from 'react';
import { format } from 'date-fns';
import { 
  Plus, Pin, AlertCircle, MessageSquare, ThumbsUp, 
  AlertTriangle, Star, Edit2, Trash2
} from 'lucide-react';
import Button from './Button';
import toast from 'react-hot-toast';

interface Note {
  id: string;
  noteType: string;
  note: string;
  isImportant: boolean;
  isPinned: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface GuestNotesProps {
  notes: Note[];
  onAddNote: (data: { noteType: string; note: string; isImportant: boolean; isPinned: boolean }) => Promise<void>;
  onUpdateNote: (noteId: string, data: Partial<Note>) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

const noteTypeConfig: Record<string, { label: string; color: string; Icon: any }> = {
  general: { label: 'General', color: '#64748b', Icon: MessageSquare },
  complaint: { label: 'Complaint', color: '#ef4444', Icon: AlertCircle },
  compliment: { label: 'Compliment', color: '#10b981', Icon: ThumbsUp },
  special_request: { label: 'Special Request', color: '#f59e0b', Icon: Star },
  vip: { label: 'VIP', color: '#9333ea', Icon: Star },
  warning: { label: 'Warning', color: '#dc2626', Icon: AlertTriangle },
};

export default function GuestNotes({ notes, onAddNote, onUpdateNote, onDeleteNote }: GuestNotesProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    noteType: 'general',
    note: '',
    isImportant: false,
    isPinned: false,
  });
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.note.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingNoteId) {
        await onUpdateNote(editingNoteId, formData);
        toast.success('Note updated successfully');
      } else {
        await onAddNote(formData);
        toast.success('Note added successfully');
      }
      
      setFormData({ noteType: 'general', note: '', isImportant: false, isPinned: false });
      setShowForm(false);
      setEditingNoteId(null);
    } catch (error) {
      toast.error('Failed to save note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (note: Note) => {
    setFormData({
      noteType: note.noteType,
      note: note.note,
      isImportant: note.isImportant,
      isPinned: note.isPinned,
    });
    setEditingNoteId(note.id);
    setShowForm(true);
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    try {
      await onDeleteNote(noteId);
      toast.success('Note deleted');
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const togglePin = async (note: Note) => {
    try {
      await onUpdateNote(note.id, { isPinned: !note.isPinned });
      toast.success(note.isPinned ? 'Note unpinned' : 'Note pinned');
    } catch (error) {
      toast.error('Failed to update note');
    }
  };

  // Sort: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div style={{ padding: '1rem' }}>
      {/* Add Note Button */}
      {!showForm && (
        <Button 
          onClick={() => setShowForm(true)}
          style={{ marginBottom: '1rem' }}
        >
          <Plus size={16} />
          Add Note
        </Button>
      )}

      {/* Note Form */}
      {showForm && (
        <div style={{
          backgroundColor: '#f8fafc',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          border: '1px solid #e2e8f0',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                Note Type
              </label>
              <select
                value={formData.noteType}
                onChange={(e) => setFormData({ ...formData, noteType: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
              >
                {Object.entries(noteTypeConfig).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                Note
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={4}
                placeholder="Enter your note..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isImportant}
                  onChange={(e) => setFormData({ ...formData, isImportant: e.target.checked })}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem', color: '#374151' }}>Important</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isPinned}
                  onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                  style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem', color: '#374151' }}>Pin to top</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingNoteId(null);
                  setFormData({ noteType: 'general', note: '', isImportant: false, isPinned: false });
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingNoteId ? 'Update' : 'Add Note'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Notes List */}
      {sortedNotes.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem 1rem', 
          color: '#94a3b8',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
        }}>
          <MessageSquare size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p style={{ fontSize: '1rem', fontWeight: '500' }}>No notes yet</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Add notes to track guest preferences and observations</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sortedNotes.map((note) => {
            const config = noteTypeConfig[note.noteType] || noteTypeConfig.general;
            const Icon = config.Icon;

            return (
              <div
                key={note.id}
                style={{
                  backgroundColor: 'white',
                  border: note.isImportant ? `2px solid ${config.color}` : '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  position: 'relative',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <div
                      style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '6px',
                        backgroundColor: `${config.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={16} style={{ color: config.color }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ 
                          fontSize: '0.875rem', 
                          fontWeight: '600',
                          color: config.color,
                        }}>
                          {config.label}
                        </span>
                        {note.isPinned && (
                          <Pin size={14} style={{ color: '#f59e0b' }} />
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {format(new Date(note.createdAt), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      onClick={() => togglePin(note)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        color: note.isPinned ? '#f59e0b' : '#94a3b8',
                      }}
                      title={note.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(note)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        color: '#94a3b8',
                      }}
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        color: '#ef4444',
                      }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Note Content */}
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.9375rem', 
                  color: '#1e293b',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                }}>
                  {note.note}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

