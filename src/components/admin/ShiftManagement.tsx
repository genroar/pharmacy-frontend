import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import {
  Clock,
  Plus,
  Edit,
  Trash2,
  Users,
  Calendar,
  MapPin,
  User,
  Eye,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Filter,
  Search
} from "lucide-react";

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  date: string;
  branchId: string;
  branchName: string;
  assignedUsers: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  maxUsers: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string;
  isActive: boolean;
}

const ShiftManagement = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const { toast } = useToast();

  const [newShift, setNewShift] = useState({
    name: "",
    startTime: "",
    endTime: "",
    date: "",
    branchId: "",
    notes: ""
  });

  const [editShift, setEditShift] = useState({
    name: "",
    startTime: "",
    endTime: "",
    date: "",
    branchId: "",
    notes: ""
  });

  // Check user permissions
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [shiftsResponse, usersResponse, branchesResponse] = await Promise.all([
        apiService.getShifts(),
        apiService.getUsers({ page: 1, limit: 100 }),
        apiService.getBranches()
      ]);

      if (shiftsResponse.success && shiftsResponse.data) {
        // Ensure data is an array
        const shiftsData = Array.isArray(shiftsResponse.data) ? shiftsResponse.data : [];
        console.log('Loaded shifts data:', shiftsData);
        let filteredShifts = shiftsData;

        // Filter shifts based on user role and company ownership
        if (user?.role === 'ADMIN') {
          // ADMIN can only see shifts for companies they own
          // For now, we'll show all shifts for ADMIN (backend should handle company ownership)
          // TODO: Implement proper company ownership filtering when backend provides company ownership data
          filteredShifts = shiftsData;
        } else if (user?.role === 'MANAGER') {
          // MANAGER can see shifts for their assigned branches
          const branchesData = branchesResponse.success && branchesResponse.data
            ? (Array.isArray(branchesResponse.data) ? branchesResponse.data : branchesResponse.data.branches)
            : [];
          const managerBranches = branchesData.filter(branch => branch.managerId === user.id);
          const managerBranchIds = managerBranches.map(branch => branch.id);
          filteredShifts = shiftsData.filter(shift =>
            managerBranchIds.includes(shift.branchId)
          );

          // Set branch filter to manager's first branch (they can only manage one branch)
          if (managerBranchIds.length > 0) {
            setBranchFilter(managerBranchIds[0]);
          }
        } else if (user?.role === 'CASHIER') {
          // CASHIER can only see shifts they are assigned to
          filteredShifts = shiftsData.filter(shift =>
            shift.assignedUsers.some(assignedUser => assignedUser.id === user.id)
          );
        }

        console.log('Filtered shifts for display:', filteredShifts);
        setShifts(filteredShifts);
      } else {
        console.log('No shifts data or error in response:', shiftsResponse);
        // If no data or error, set empty array
        setShifts([]);
      }

      if (usersResponse.success && usersResponse.data) {
        setUsers(usersResponse.data.users || []);
      }

      if (branchesResponse.success && branchesResponse.data) {
        setBranches(Array.isArray(branchesResponse.data) ? branchesResponse.data : branchesResponse.data.branches);
      }
    } catch (error) {
      console.error('Error loading shift data:', error);
      // Ensure shifts is always an array even on error
      setShifts([]);
      toast({
        title: "Error",
        description: "Failed to load shift data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Auto-set branch ID for managers when create dialog opens
  useEffect(() => {
    if (isCreateOpen && user?.role === 'MANAGER' && branches.length > 0) {
      console.log('Setting branch for manager:', user.id);
      console.log('Available branches:', branches);

      // Try to find branch by managerId
      let managerBranch = branches.find(b => b.managerId === user.id);

      // If not found, try alternative field names
      if (!managerBranch) {
        managerBranch = branches.find(b => b.manager === user.id);
      }
      if (!managerBranch) {
        managerBranch = branches.find(b => b.managerId === user.id);
      }

      // If still not found, use the first available branch
      if (!managerBranch && branches.length > 0) {
        managerBranch = branches[0];
        console.log('Using first available branch:', managerBranch);
      }

      if (managerBranch && newShift.branchId !== managerBranch.id) {
        console.log('Setting branch ID to:', managerBranch.id);
        setNewShift(prev => ({ ...prev, branchId: managerBranch.id }));
      }
    }
  }, [isCreateOpen, user?.role, user?.id, branches, newShift.branchId]);

  const handleCreateShift = async () => {
    // For managers, automatically set the branch ID
    let shiftData = { ...newShift };
    if (user?.role === 'MANAGER') {
      console.log('User ID:', user.id);
      console.log('Branches:', branches);

      // Try to find branch by managerId
      let managerBranch = branches.find(b => b.managerId === user.id);
      console.log('Manager branch found by managerId:', managerBranch);

      // If not found, try alternative field names
      if (!managerBranch) {
        managerBranch = branches.find(b => b.manager === user.id);
      }

      // If still not found, use the first available branch
      if (!managerBranch && branches.length > 0) {
        managerBranch = branches[0];
        console.log('Using first available branch for manager:', managerBranch);
      }

      if (managerBranch) {
        shiftData.branchId = managerBranch.id;
        console.log('Set branch ID to:', managerBranch.id);
      }
    }

    console.log('Shift data before validation:', shiftData);
    console.log('Required fields check:', {
      name: shiftData.name,
      startTime: shiftData.startTime,
      endTime: shiftData.endTime,
      date: shiftData.date,
      branchId: shiftData.branchId
    });

    if (!shiftData.name || !shiftData.startTime || !shiftData.endTime || !shiftData.date || !shiftData.branchId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate that end time is after start time
    const startTime = new Date(`2000-01-01T${shiftData.startTime}`);
    const endTime = new Date(`2000-01-01T${shiftData.endTime}`);

    if (endTime <= startTime) {
      toast({
        title: "Error",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    try {
      const shiftPayload = {
        name: shiftData.name,
        startTime: shiftData.startTime,
        endTime: shiftData.endTime,
        date: shiftData.date,
        branchId: shiftData.branchId,
        notes: shiftData.notes || ""
      };

      console.log('Creating shift with payload:', shiftPayload);
      console.log('API Service createShift method exists:', typeof apiService.createShift);

      const response = await apiService.createShift(shiftPayload);

      console.log('API Response:', response);

      if (response.success) {
        toast({
          title: "Success",
          description: "Shift created successfully",
        });
        setIsCreateOpen(false);
        setNewShift({
          name: "",
          startTime: "",
          endTime: "",
          date: "",
          branchId: "",
          notes: ""
        });
        loadData();
      } else {
        console.error('API Error Response:', response);
        toast({
          title: "Error",
          description: response.message || "Failed to create shift",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating shift:', error);
      toast({
        title: "Error",
        description: "Failed to create shift",
        variant: "destructive",
      });
    }
  };

  const handleEditShift = async () => {
    if (!editingShift || !editShift.name || !editShift.startTime || !editShift.endTime || !editShift.date || !editShift.branchId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate that end time is after start time
    const startTime = new Date(`2000-01-01T${editShift.startTime}`);
    const endTime = new Date(`2000-01-01T${editShift.endTime}`);

    if (endTime <= startTime) {
      toast({
        title: "Error",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiService.updateShift(editingShift.id, {
        ...editShift,
        maxUsers: 1,
        assignedUserIds: []
      });
      if (response.success) {
        toast({
          title: "Success",
          description: "Shift updated successfully",
        });
        setIsEditOpen(false);
        setEditingShift(null);
        loadData();
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to update shift",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating shift:', error);
      toast({
        title: "Error",
        description: "Failed to update shift",
        variant: "destructive",
      });
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      const response = await apiService.deleteShift(shiftId);
      if (response.success) {
        toast({
          title: "Success",
          description: "Shift deleted successfully",
        });
        loadData();
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to delete shift",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast({
        title: "Error",
        description: "Failed to delete shift",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (shift: Shift) => {
    setEditingShift(shift);
    setEditShift({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      date: shift.date,
      branchId: shift.branchId,
      notes: shift.notes || ""
    });
    setIsEditOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return Clock;
      case 'active': return CheckCircle;
      case 'completed': return CheckCircle;
      case 'cancelled': return X;
      default: return Clock;
    }
  };

  // Filter shifts based on search and filters
  const filteredShifts = (Array.isArray(shifts) ? shifts : []).filter(shift => {
    const matchesSearch = shift.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         shift.branchName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || shift.status === statusFilter;
    const matchesBranch = branchFilter === "all" || shift.branchId === branchFilter;

    return matchesSearch && matchesStatus && matchesBranch;
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading shift data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Shift Management</h1>
          <p className="text-muted-foreground">
            {canEdit ? 'Manage employee shifts and schedules' : 'View your assigned shifts'}
          </p>
        </div>
        {canCreate && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200">
                <Plus className="w-4 h-4 mr-2" />
                Create Shift
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Shift</DialogTitle>
                <DialogDescription>
                  Create a new shift for employees to work
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shiftName">Shift Name *</Label>
                    <Input
                      id="shiftName"
                      placeholder="e.g., Morning Shift"
                      value={newShift.name}
                      onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shiftDate">Date *</Label>
                    <Input
                      id="shiftDate"
                      type="date"
                      value={newShift.date}
                      onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time *</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={newShift.startTime}
                      onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time *</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={newShift.endTime}
                      onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                    />
                  </div>
                </div>

                {/* Branch selection - only show for ADMIN and SUPERADMIN */}
                {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch *</Label>
                    <Select value={newShift.branchId} onValueChange={(value) => setNewShift({ ...newShift, branchId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* For MANAGER - show current branch info */}
                {user?.role === 'MANAGER' && (
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                          {branches.find(b => b.managerId === user.id)?.name || 'Your Branch'}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        Shifts will be created for your assigned branch
                      </p>
                    </div>
                  </div>
                )}


                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes for this shift..."
                    value={newShift.notes}
                    onChange={(e) => setNewShift({ ...newShift, notes: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200" onClick={handleCreateShift}>
                  Create Shift
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search shifts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {/* Only show branch filter for ADMIN and SUPERADMIN */}
        {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Shifts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredShifts.map((shift) => {
          const StatusIcon = getStatusIcon(shift.status);
          return (
            <Card key={shift.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{shift.name}</CardTitle>
                  <Badge className={getStatusColor(shift.status)}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {shift.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(shift.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{shift.startTime} - {shift.endTime}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{shift.branchName}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{shift.assignedUsers.length} users assigned</span>
                  </div>

                  {shift.assignedUsers.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Assigned Users:</p>
                      <div className="flex flex-wrap gap-1">
                        {shift.assignedUsers.map((user) => (
                          <Badge key={user.id} variant="outline" className="text-xs">
                            {user.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {shift.notes && (
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium">Notes:</p>
                      <p>{shift.notes}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex space-x-2">
                      {canEdit && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(shift)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteShift(shift.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </>
                      )}
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredShifts.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No shifts found</h3>
          <p className="text-muted-foreground">
            {searchQuery || statusFilter !== "all" || branchFilter !== "all"
              ? "Try adjusting your filters to see more results"
              : canCreate
                ? "Create your first shift to get started"
                : "No shifts have been assigned to you yet"
            }
          </p>
        </div>
      )}

      {/* Edit Shift Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
            <DialogDescription>
              Update shift details and assignments
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editShiftName">Shift Name *</Label>
                <Input
                  id="editShiftName"
                  placeholder="e.g., Morning Shift"
                  value={editShift.name}
                  onChange={(e) => setEditShift({ ...editShift, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editShiftDate">Date *</Label>
                <Input
                  id="editShiftDate"
                  type="date"
                  value={editShift.date}
                  onChange={(e) => setEditShift({ ...editShift, date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editStartTime">Start Time *</Label>
                <Input
                  id="editStartTime"
                  type="time"
                  value={editShift.startTime}
                  onChange={(e) => setEditShift({ ...editShift, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEndTime">End Time *</Label>
                <Input
                  id="editEndTime"
                  type="time"
                  value={editShift.endTime}
                  onChange={(e) => setEditShift({ ...editShift, endTime: e.target.value })}
                />
              </div>
            </div>

            {/* Branch selection - only show for ADMIN and SUPERADMIN */}
            {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
              <div className="space-y-2">
                <Label htmlFor="editBranch">Branch *</Label>
                <Select value={editShift.branchId} onValueChange={(value) => setEditShift({ ...editShift, branchId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* For MANAGER - show current branch info */}
            {user?.role === 'MANAGER' && (
              <div className="space-y-2">
                <Label htmlFor="editBranch">Branch</Label>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      {branches.find(b => b.managerId === user.id)?.name || 'Your Branch'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    This shift belongs to your assigned branch
                  </p>
                </div>
              </div>
            )}


            <div className="space-y-2">
              <Label htmlFor="editNotes">Notes</Label>
              <Textarea
                id="editNotes"
                placeholder="Additional notes for this shift..."
                value={editShift.notes}
                onChange={(e) => setEditShift({ ...editShift, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditShift}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftManagement;
