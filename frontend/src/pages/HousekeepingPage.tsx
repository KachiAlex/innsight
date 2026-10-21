import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Sparkles, CheckCircle, Plus } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
} from '../components/ui';
import styles from './HousekeepingPage.module.css';

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
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const fetchTasks = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/tenants/${user.tenantId}/housekeeping`);
      setTasks(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

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

  return (
    <Layout>
      <PageHeader
        title="Housekeeping"
        subtitle={`${tasks.filter((t) => t.status !== 'completed').length} open task${tasks.filter((t) => t.status !== 'completed').length !== 1 ? 's' : ''}`}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>
            Create task
          </Button>
        }
      />

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search room #, task type, status, or staff…"
      />

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="190px" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTasks} />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={28} strokeWidth={1.6} />}
          title={searchTerm ? 'No tasks match your search' : 'No housekeeping tasks yet'}
          description={
            searchTerm
              ? 'Try adjusting your search terms to find tasks'
              : 'Create your first housekeeping task to get started'
          }
          action={
            !searchTerm ? (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                Create task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={styles.grid}>
          {filteredTasks.map((task) => (
            <div key={task.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardIcon}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className={styles.cardTitle}>Room {task.room?.roomNumber}</h3>
                  <p className={styles.cardSub}>{task.taskType.replace(/_/g, ' ')}</p>
                </div>
              </div>

              <StatusBadge status={task.status} />

              {task.assignedStaff && (
                <div className={styles.cardMeta}>
                  Assigned to {task.assignedStaff.firstName} {task.assignedStaff.lastName}
                </div>
              )}

              {task.status !== 'completed' && (
                <div className={styles.cardActions}>
                  <Button
                    variant="primary"
                    block
                    icon={<CheckCircle size={16} />}
                    onClick={() => setSelectedTask(tasks.find((t) => t.id === task.id) || null)}
                  >
                    Complete task
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateTaskModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchTasks();
        }}
      />

      <CompleteTaskModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSuccess={() => {
          setSelectedTask(null);
          fetchTasks();
        }}
      />
    </Layout>
  );
}

function CreateTaskModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get(`/tenants/${user?.tenantId}/rooms`)
      .then((res) => setRooms(res.data.data || []))
      .catch(() => {});
  }, [open, user?.tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/housekeeping`, {
        roomId: formData.roomId,
        taskType: formData.taskType,
        assignedTo: formData.assignedTo || undefined,
        notes: formData.notes || undefined,
      });
      toast.success('Task created successfully');
      onSuccess();
    } catch {
      // Error handled by API interceptor
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create housekeeping task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>
            Create task
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="stack">
        <Field label="Room" required>
          <Select
            value={formData.roomId}
            onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
            required
          >
            <option value="">Select a room</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNumber} — {room.roomType}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Task type" required>
          <Select
            value={formData.taskType}
            onChange={(e) => setFormData({ ...formData, taskType: e.target.value as any })}
            required
          >
            <option value="cleaning">Cleaning</option>
            <option value="inspection">Inspection</option>
            <option value="maintenance_prep">Maintenance prep</option>
          </Select>
        </Field>
        <Field label="Notes" hint="Optional">
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder="Optional notes"
          />
        </Field>
      </form>
    </Modal>
  );
}

function CompleteTaskModal({
  task,
  onClose,
  onSuccess,
}: {
  task: TaskDetails | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setPhotos([]);
      setNotes('');
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/housekeeping/${task.id}/complete`, {
        photos: photos.length > 0 ? photos : undefined,
        notes: notes || undefined,
      });
      toast.success('Task completed successfully');
      onSuccess();
    } catch {
      // Error handled by API interceptor
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!task}
      onClose={onClose}
      title={`Complete task — Room ${task?.room?.roomNumber ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<CheckCircle size={15} />}
            loading={saving}
            onClick={handleSubmit}
          >
            Complete task
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="stack-lg">
        <Field label="Photos" hint="Optional — up to 5 images">
          <FileUpload
            onUploadComplete={setPhotos}
            maxFiles={5}
            maxSizeMB={5}
            accept="image/*"
            multiple={true}
          />
          {photos.length > 0 && (
            <div className={styles.photoGrid}>
              {photos.map((url, index) => (
                <img key={index} src={url} alt={`Completion photo ${index + 1}`} />
              ))}
            </div>
          )}
        </Field>
        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Add any notes about the completed task…"
          />
        </Field>
      </form>
    </Modal>
  );
}
