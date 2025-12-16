import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Sparkles, CheckCircle, Plus, X } from 'lucide-react';
import { CardSkeleton } from '../components/LoadingSkeleton';
import FileUpload from '../components/FileUpload';
import toast from 'react-hot-toast';
import SearchInput from '../components/SearchInput';
import { useDebounce } from '../hooks/useDebounce';
import EmptyState from '../components/EmptyState';

interface Task {
  id: string;
  taskType: string;
  status: string;
  room: {
    roomNumber: string;
  };
  assignedStaff: {
    firstName: string;
    lastName: string;
  } | null;
}

interface TaskDetails extends Task {
  photos?: string[];
  checklist?: any[];
  notes?: string;
}

export default function HousekeepingPage() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<TaskDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const fetchTasks = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const response = await api.get(`/tenants/${user.tenantId}/housekeeping`);
      setTasks(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch tasks:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to fetch tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCompleteTask = async (taskId: string) => {
    setSelectedTask(tasks.find(t => t.id === taskId) || null);
  };

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (!debouncedSearchTerm) return true;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return (
      task.room?.roomNumber.toLowerCase().includes(searchLower) ||
      task.taskType.toLowerCase().includes(searchLower) ||
      task.status.toLowerCase().includes(searchLower) ||
      task.assignedStaff?.firstName.toLowerCase().includes(searchLower) ||
      task.assignedStaff?.lastName.toLowerCase().includes(searchLower)
    );
  }), [tasks, debouncedSearchTerm]);

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Housekeeping</h1>
          <CardSkeleton count={6} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, color: '#1e293b' }}>Housekeeping</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            <Plus size={20} />
            Create Task
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by room number, task type, status, or staff..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Sparkles size={24} style={{ color: '#8b5cf6' }} />
                <div>
                  <h3 style={{ margin: 0, color: '#1e293b' }}>Room {task.room?.roomNumber}</h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>{task.taskType}</p>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background:
                      task.status === 'completed'
                        ? '#d1fae5'
                        : task.status === 'in_progress'
                        ? '#dbeafe'
                        : '#fee2e2',
                    color:
                      task.status === 'completed'
                        ? '#065f46'
                        : task.status === 'in_progress'
                        ? '#1e40af'
                        : '#991b1b',
                  }}
                >
                  {task.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {task.assignedStaff && (
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Assigned to: {task.assignedStaff.firstName} {task.assignedStaff.lastName}
                </div>
              )}

              {task.status !== 'completed' && (
                <button
                  onClick={() => handleCompleteTask(task.id)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#059669';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#10b981';
                  }}
                >
                  <CheckCircle size={18} />
                  Complete Task
                </button>
              )}
            </div>
          ))}
        </div>

        {!loading && filteredTasks.length === 0 && (
          <EmptyState
            icon={Sparkles}
            title={searchTerm ? 'No tasks match your search' : 'No housekeeping tasks yet'}
            description={searchTerm 
              ? 'Try adjusting your search terms to find tasks' 
              : 'Create your first housekeeping task to get started'}
            action={searchTerm ? undefined : {
              label: 'Create Task',
              onClick: () => setShowCreateModal(true),
            }}
          />
        )}

        {showCreateModal && (
          <CreateTaskModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchTasks();
            }}
          />
        )}

        {selectedTask && (
          <CompleteTaskModal
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onSuccess={() => {
              setSelectedTask(null);
              fetchTasks();
            }}
          />
        )}
      </div>
    </Layout>
  );
}

function CreateTaskModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    roomId: '',
    taskType: 'cleaning' as 'cleaning' | 'inspection' | 'maintenance_prep',
    assignedTo: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/rooms`);
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post(`/tenants/${user?.tenantId}/housekeeping`, {
        roomId: formData.roomId,
        taskType: formData.taskType,
        assignedTo: formData.assignedTo || undefined,
        notes: formData.notes || undefined,
      });
      toast.success('Task created successfully');
      onSuccess();
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          width: '100%',
          maxWidth: '500px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#1e293b' }}>Create Housekeeping Task</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Room *
              </label>
              <select
                value={formData.roomId}
                onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              >
                <option value="">Select a room</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.roomNumber} - {room.roomType}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Task Type *
              </label>
              <select
                value={formData.taskType}
                onChange={(e) => setFormData({ ...formData, taskType: e.target.value as any })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              >
                <option value="cleaning">Cleaning</option>
                <option value="inspection">Inspection</option>
                <option value="maintenance_prep">Maintenance Prep</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  resize: 'vertical',
                }}
                placeholder="Optional notes"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: loading ? '#94a3b8' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteTaskModal({
  task,
  onClose,
  onSuccess,
}: {
  task: TaskDetails;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUploadComplete = (urls: string[]) => {
    setPhotos(urls);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post(`/tenants/${user?.tenantId}/housekeeping/${task.id}/complete`, {
        photos: photos.length > 0 ? photos : undefined,
        notes: notes || undefined,
      });
      toast.success('Task completed successfully');
      onSuccess();
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#1e293b' }}>Complete Task - Room {task.room?.roomNumber}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Upload Photos (Optional)
              </label>
              <FileUpload
                onUploadComplete={handleUploadComplete}
                maxFiles={5}
                maxSizeMB={5}
                accept="image/*"
                multiple={true}
              />
              {photos.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
                  {photos.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Photo ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  resize: 'vertical',
                }}
                placeholder="Add any notes about the completed task..."
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: loading ? '#94a3b8' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <CheckCircle size={18} />
                {loading ? 'Completing...' : 'Complete Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
