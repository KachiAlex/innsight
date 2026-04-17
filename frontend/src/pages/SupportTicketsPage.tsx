import { useEffect, useState } from 'react';
import {
  Ticket,
  Plus,
  Search,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_for_customer' | 'on_hold' | 'resolved' | 'closed';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  responseCount: number;
}

interface TicketStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  averageResolutionTime: number;
  averageResponseTime: number;
}

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newResponse, setNewResponse] = useState('');

  useEffect(() => {
    fetchTickets();
  }, [selectedStatus, selectedPriority]);

  const fetchTickets = async () => {
    try {
      setLoading(true);

      // Fetch stats
      const statsRes = await api.get('/superadmin/support/stats');
      setStats(statsRes.data.data);

      // Fetch tickets
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedPriority !== 'all') params.append('priority', selectedPriority);

      const ticketsRes = await api.get(`/superadmin/support?${params.toString()}`);
      setTickets(ticketsRes.data.data || []);
    } catch (error: any) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    // Filter locally
    if (term) {
      const filtered = tickets.filter(
        t =>
          t.ticketNumber.toLowerCase().includes(term) ||
          t.subject.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term)
      );
      setTickets(filtered);
    } else {
      fetchTickets();
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !newResponse.trim()) {
      toast.error('Please enter a response');
      return;
    }

    try {
      await api.post(`/superadmin/support/${selectedTicket.id}/responses`, {
        message: newResponse,
        senderType: 'admin',
      });

      toast.success('Response added successfully');
      setNewResponse('');
      fetchTickets();
    } catch (error: any) {
      toast.error('Failed to add response');
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!selectedTicket) return;

    try {
      await api.patch(`/superadmin/support/${selectedTicket.id}/status`, {
        status,
      });

      toast.success('Status updated');
      setSelectedTicket(null);
      setShowDetailModal(false);
      fetchTickets();
    } catch (error: any) {
      toast.error('Failed to update status');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800';
      case 'waiting_for_customer':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return <CheckCircle className="h-5 w-5" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const filteredTickets = tickets.filter(
    t =>
      !searchTerm ||
      t.ticketNumber.toLowerCase().includes(searchTerm) ||
      t.subject.toLowerCase().includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-lg">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
              <p className="text-gray-600">Manage customer support requests</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            New Ticket
          </button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Tickets</div>
              <div className="text-3xl font-bold text-blue-600">{stats.totalTickets}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Open</div>
              <div className="text-3xl font-bold text-orange-600">{stats.openTickets}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">In Progress</div>
              <div className="text-3xl font-bold text-purple-600">{stats.inProgressTickets}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Resolved</div>
              <div className="text-3xl font-bold text-green-600">{stats.resolvedTickets}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Avg Resolution</div>
              <div className="text-3xl font-bold text-gray-600">
                {stats.averageResolutionTime.toFixed(1)}h
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ticket number, subject..."
                  value={searchTerm}
                  onChange={handleFilterSearch}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_for_customer">Waiting for Customer</option>
                <option value="on_hold">On Hold</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={selectedPriority}
                onChange={e => setSelectedPriority(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets Table */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-500">Loading tickets...</div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-500">No tickets found</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ticket</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Subject</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Priority</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Responses</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTickets.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-gray-700">{ticket.ticketNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{ticket.subject}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{ticket.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{ticket.responseCount}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setShowDetailModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedTicket.ticketNumber}</h2>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Subject</div>
                  <div className="font-medium text-gray-900">{selectedTicket.subject}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Category</div>
                  <div className="font-medium text-gray-900">{selectedTicket.category}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Priority</div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Status</div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                    {selectedTicket.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4 mb-4">
                <div className="text-sm text-gray-600 mb-2">Update Status</div>
                <div className="flex gap-2 flex-wrap">
                  {['open', 'in_progress', 'waiting_for_customer', 'on_hold', 'resolved', 'closed'].map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusUpdate(status)}
                      className="px-3 py-1 rounded text-xs font-medium bg-gray-200 hover:bg-gray-300 text-gray-800 transition"
                    >
                      {status.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Add Response</label>
                <textarea
                  value={newResponse}
                  onChange={e => setNewResponse(e.target.value)}
                  placeholder="Type your response..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-20"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleReply}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedTicket(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-6 space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">Create Support Ticket</h2>
              <p className="text-gray-600">
                This interface is being finalized. Please continue using existing channels to create tickets in the
                meantime.
              </p>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
