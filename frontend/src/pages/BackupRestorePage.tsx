import { useEffect, useState } from 'react';
import { HardDrive, Download, Plus, Clock, CheckCircle, AlertCircle, RotateCcw, Trash2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface Backup {
  id: string;
  name: string;
  timestamp: string;
  size: number;
  status: 'completed' | 'in_progress' | 'failed';
  dataTypes: string[];
  tenantId?: string;
}

interface BackupSchedule {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  retentionDays: number;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

interface BackupMetrics {
  totalBackups: number;
  totalSize: number;
  lastBackupTime?: string;
  successRate: number;
  failedBackups: number;
  schedules: number;
}

export default function BackupRestorePage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [metrics, setMetrics] = useState<BackupMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);

  const [newSchedule, setNewSchedule] = useState({
    name: '',
    frequency: 'daily' as const,
    time: '02:00',
    retentionDays: 30,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [backupsRes, schedulesRes, metricsRes] = await Promise.all([
        api.get('/superadmin/backups'),
        api.get('/superadmin/backup-schedules'),
        api.get('/superadmin/backup-metrics'),
      ]);

      setBackups(backupsRes.data.data || []);
      setSchedules(schedulesRes.data.data || []);
      setMetrics(metricsRes.data.data || null);
    } catch (error: any) {
      console.error('Error fetching backup data:', error);
      toast.error('Failed to load backup data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      await api.post('/superadmin/backups', {
        name: `Manual Backup ${new Date().toLocaleDateString()}`,
        dataTypes: ['database', 'files', 'configuration'],
      });

      toast.success('Backup started');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to create backup');
    }
  };

  const handleCreateSchedule = async () => {
    if (!newSchedule.name.trim()) {
      toast.error('Please enter a schedule name');
      return;
    }

    try {
      await api.post('/superadmin/backup-schedules', newSchedule);

      toast.success('Backup schedule created');
      setNewSchedule({ name: '', frequency: 'daily', time: '02:00', retentionDays: 30 });
      setShowScheduleModal(false);
      fetchData();
    } catch (error: any) {
      toast.error('Failed to create backup schedule');
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;

    if (!confirm(`Are you sure you want to restore from backup "${selectedBackup.name}"? This will overwrite current data.`)) {
      return;
    }

    try {
      await api.post(`/superadmin/backups/${selectedBackup.id}/restore`);

      toast.success('Restore started. This may take a few minutes.');
      setShowRestoreModal(false);
      setSelectedBackup(null);
      fetchData();
    } catch (error: any) {
      toast.error('Failed to start restore');
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    try {
      await api.delete(`/superadmin/backups/${backupId}`);
      toast.success('Backup deleted');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete backup');
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    try {
      const response = await api.get(`/superadmin/backups/${backupId}/download`);
      // Trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup-${backupId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error: any) {
      toast.error('Failed to download backup');
    }
  };

  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    try {
      await api.patch(`/superadmin/backup-schedules/${scheduleId}`, {
        enabled: !enabled,
      });

      toast.success(`Schedule ${!enabled ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update schedule');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600 text-white rounded-lg">
              <HardDrive className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Backup & Restore</h1>
              <p className="text-gray-600">Manage and restore platform backups</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Calendar className="h-5 w-5" />
              Schedule
            </button>
            <button
              onClick={handleCreateBackup}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="h-5 w-5" />
              Backup Now
            </button>
          </div>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Backups</div>
              <div className="text-3xl font-bold text-purple-600">{metrics.totalBackups}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Size</div>
              <div className="text-3xl font-bold text-blue-600">{formatBytes(metrics.totalSize)}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Success Rate</div>
              <div className="text-3xl font-bold text-green-600">{metrics.successRate}%</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Failed Backups</div>
              <div className="text-3xl font-bold text-red-600">{metrics.failedBackups}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Active Schedules</div>
              <div className="text-3xl font-bold text-gray-600">{metrics.schedules}</div>
            </div>
          </div>
        )}

        {/* Backups Table */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Backups</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="text-gray-500">Loading backups...</div>
            </div>
          ) : backups.length === 0 ? (
            <div className="p-8 text-center">
              <HardDrive className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-gray-500 mb-4">No backups yet</div>
              <button
                onClick={handleCreateBackup}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                Create Your First Backup
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Size</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Data Types</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {backups.map(backup => (
                    <tr key={backup.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{backup.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {backup.status === 'completed' && (
                            <>
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-sm text-green-600">Completed</span>
                            </>
                          )}
                          {backup.status === 'in_progress' && (
                            <>
                              <Clock className="h-5 w-5 text-blue-600 animate-spin" />
                              <span className="text-sm text-blue-600">In Progress</span>
                            </>
                          )}
                          {backup.status === 'failed' && (
                            <>
                              <AlertCircle className="h-5 w-5 text-red-600" />
                              <span className="text-sm text-red-600">Failed</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{formatBytes(backup.size)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {backup.dataTypes.map(type => (
                            <span key={type} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                              {type}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {new Date(backup.timestamp).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {backup.status === 'completed' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedBackup(backup);
                                  setShowRestoreModal(true);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Restore from backup"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDownloadBackup(backup.id)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded transition"
                                title="Download backup"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteBackup(backup.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete backup"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Backup Schedules */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Backup Schedules</h2>
          </div>

          {schedules.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-gray-500 mb-4">No backup schedules configured</div>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Create Schedule
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Frequency</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Retention</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Last Run</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Next Run</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {schedules.map(schedule => (
                    <tr key={schedule.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{schedule.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 capitalize">{schedule.frequency}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{schedule.time}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{schedule.retentionDays} days</span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleSchedule(schedule.id, schedule.enabled)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            schedule.enabled
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {schedule.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        {schedule.lastRun ? (
                          <span className="text-sm text-gray-600">
                            {new Date(schedule.lastRun).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {schedule.nextRun ? (
                          <span className="text-sm text-gray-600">
                            {new Date(schedule.nextRun).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            if (confirm('Delete this schedule?')) {
                              fetchData();
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                          title="Delete schedule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Backup Schedule</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Daily Backup"
                    value={newSchedule.name}
                    onChange={e => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    value={newSchedule.frequency}
                    onChange={e => setNewSchedule(prev => ({ ...prev, frequency: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={newSchedule.time}
                    onChange={e => setNewSchedule(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Retention (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={newSchedule.retentionDays}
                    onChange={e => setNewSchedule(prev => ({ ...prev, retentionDays: parseInt(e.target.value) }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCreateSchedule}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                  >
                    Create Schedule
                  </button>
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Confirm Restore</h2>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    This will overwrite all current data with the backup data. Make sure you have a recent backup before proceeding.
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-1">Backup Name</div>
                <div className="font-medium text-gray-900">{selectedBackup.name}</div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRestore}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Restore Backup
                </button>
                <button
                  onClick={() => {
                    setShowRestoreModal(false);
                    setSelectedBackup(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
