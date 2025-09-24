import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  Calendar,
  Timer,
  Play,
  Square,
  DollarSign,
  AlertCircle,
  Loader2,
  Plus,
  Minus
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/api";

interface Shift {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    name: string;
    employeeId: string;
    position: string;
  };
  shiftDate: string;
  startTime: string;
  endTime?: string;
  openingBalance: number;
  cashIn: number;
  cashOut: number;
  expectedBalance?: number;
  actualBalance?: number;
  difference?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  createdAt: string;
}

const ShiftManagement = () => {
  const { user } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [recentShifts, setRecentShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  // Form states
  const [newShift, setNewShift] = useState({
    openingBalance: "",
    notes: ""
  });

  const [endShift, setEndShift] = useState({
    actualBalance: "",
    notes: ""
  });

  const [updateShift, setUpdateShift] = useState({
    cashIn: "",
    cashOut: "",
    notes: ""
  });

  // Load data on component mount
  useEffect(() => {
    if (user?.id) {
      loadActiveShift();
      loadRecentShifts();
    }
  }, [user?.id]);

  const loadActiveShift = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError("");

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Load active shift from localStorage
      const storedShifts = localStorage.getItem('shifts');
      if (storedShifts) {
        try {
          const shifts = JSON.parse(storedShifts);
          const activeShiftData = shifts.find((shift: any) => 
            shift.employeeId === user.id && shift.status === 'ACTIVE'
          );
          setActiveShift(activeShiftData || null);
        } catch (e) {
          console.warn('Error parsing stored shifts');
          setActiveShift(null);
        }
      } else {
        setActiveShift(null);
      }
    } catch (err) {
      console.error('Error loading active shift:', err);
      setError('Failed to load active shift');
      setActiveShift(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentShifts = async () => {
    if (!user?.id) return;

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Load recent shifts from localStorage
      const storedShifts = localStorage.getItem('shifts');
      if (storedShifts) {
        try {
          const shifts = JSON.parse(storedShifts);
          const userShifts = shifts
            .filter((shift: any) => shift.employeeId === user.id)
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 10);
          setRecentShifts(userShifts);
        } catch (e) {
          console.warn('Error parsing stored shifts');
          setRecentShifts([]);
        }
      } else {
        setRecentShifts([]);
      }
    } catch (err) {
      console.error('Error loading recent shifts:', err);
      setRecentShifts([]);
    }
  };

  const handleStartShift = async () => {
    if (!user?.id) {
      setError("User information not found");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create new shift
      const newShiftData = {
        id: `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        employeeId: user.id,
        employee: {
          id: user.id,
          name: user.name || "Unknown User",
          employeeId: user.id,
          position: user.role || "Cashier"
        },
        shiftDate: new Date().toISOString().split('T')[0],
        startTime: new Date().toISOString(),
        endTime: undefined,
        openingBalance: parseFloat(newShift.openingBalance) || 0,
        cashIn: 0,
        cashOut: 0,
        expectedBalance: parseFloat(newShift.openingBalance) || 0,
        actualBalance: undefined,
        difference: undefined,
        status: 'ACTIVE' as const,
        notes: newShift.notes.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      // Store in localStorage
      const existingShifts = JSON.parse(localStorage.getItem('shifts') || '[]');
      existingShifts.unshift(newShiftData);
      localStorage.setItem('shifts', JSON.stringify(existingShifts));

      setActiveShift(newShiftData);
      setNewShift({ openingBalance: "", notes: "" });
      setIsStartDialogOpen(false);
      alert("Shift started successfully!");
    } catch (err) {
      console.error('Error starting shift:', err);
      setError("Failed to start shift. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeShift?.id) {
      setError("No active shift found");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const actualBalance = parseFloat(endShift.actualBalance) || 0;
      const expectedBalance = calculateExpectedBalance();
      const difference = actualBalance - expectedBalance;

      // Update shift in localStorage
      const storedShifts = localStorage.getItem('shifts');
      if (storedShifts) {
        try {
          const shifts = JSON.parse(storedShifts);
          const updatedShifts = shifts.map((shift: any) => 
            shift.id === activeShift.id 
              ? {
                  ...shift,
                  endTime: new Date().toISOString(),
                  actualBalance: actualBalance,
                  difference: difference,
                  status: 'COMPLETED',
                  notes: endShift.notes.trim() || shift.notes
                }
              : shift
          );
          localStorage.setItem('shifts', JSON.stringify(updatedShifts));
        } catch (e) {
          console.warn('Error updating shift in localStorage');
        }
      }

      setActiveShift(null);
      setEndShift({ actualBalance: "", notes: "" });
      setIsEndDialogOpen(false);
      await loadRecentShifts();
      alert("Shift ended successfully!");
    } catch (err) {
      console.error('Error ending shift:', err);
      setError("Failed to end shift. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateShift = async () => {
    if (!activeShift?.id) {
      setError("No active shift found");
      return;
    }

    try {
      setIsProcessing(true);
      setError("");

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const cashIn = parseFloat(updateShift.cashIn) || 0;
      const cashOut = parseFloat(updateShift.cashOut) || 0;
      const newCashIn = activeShift.cashIn + cashIn;
      const newCashOut = activeShift.cashOut + cashOut;
      const expectedBalance = activeShift.openingBalance + newCashIn - newCashOut;

      // Update shift in localStorage
      const storedShifts = localStorage.getItem('shifts');
      if (storedShifts) {
        try {
          const shifts = JSON.parse(storedShifts);
          const updatedShifts = shifts.map((shift: any) => 
            shift.id === activeShift.id 
              ? {
                  ...shift,
                  cashIn: newCashIn,
                  cashOut: newCashOut,
                  expectedBalance: expectedBalance,
                  notes: updateShift.notes.trim() || shift.notes
                }
              : shift
          );
          localStorage.setItem('shifts', JSON.stringify(updatedShifts));

          // Update active shift state
          setActiveShift({
            ...activeShift,
            cashIn: newCashIn,
            cashOut: newCashOut,
            expectedBalance: expectedBalance,
            notes: updateShift.notes.trim() || activeShift.notes
          });
        } catch (e) {
          console.warn('Error updating shift in localStorage');
        }
      }

      setUpdateShift({ cashIn: "", cashOut: "", notes: "" });
      setIsUpdateDialogOpen(false);
      alert("Shift updated successfully!");
    } catch (err) {
      console.error('Error updating shift:', err);
      setError("Failed to update shift. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "COMPLETED":
        return "bg-blue-100 text-blue-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateExpectedBalance = () => {
    if (!activeShift) return 0;
    return activeShift.openingBalance + activeShift.cashIn - activeShift.cashOut;
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Shift Management</h1>
          <p className="text-muted-foreground">Manage your work shifts and cash handling</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {user?.name || 'Unknown User'}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-800 font-medium">Error: {error}</p>
          </div>
        </div>
      )}

      {/* Current Shift Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Current Shift</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeShift ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge className={getStatusColor(activeShift.status)}>
                      {activeShift.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-muted-foreground">Started</p>
                    <p className="text-sm">{formatTime(activeShift.startTime)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Opening Balance</p>
                    <p className="text-lg font-bold">PKR {activeShift.openingBalance.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Expected Balance</p>
                    <p className="text-lg font-bold">PKR {calculateExpectedBalance().toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cash In</p>
                    <p className="text-lg font-bold text-green-600">+PKR {activeShift.cashIn.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cash Out</p>
                    <p className="text-lg font-bold text-red-600">-PKR {activeShift.cashOut.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-muted-foreground">No active shift</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Date</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatDate(new Date().toISOString())}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shift Actions */}
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Timer className="w-5 h-5" />
            <span>Shift Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {!activeShift ? (
              <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2 bg-green-600 hover:bg-green-700">
                    <Play className="w-4 h-4" />
                    <span>Start Shift</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start New Shift</DialogTitle>
                    <DialogDescription>
                      Begin your work shift with opening cash balance.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="openingBalance">Opening Balance (PKR)</Label>
                      <Input
                        id="openingBalance"
                        type="number"
                        placeholder="0"
                        value={newShift.openingBalance}
                        onChange={(e) => setNewShift({...newShift, openingBalance: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Add any notes about your shift..."
                        value={newShift.notes}
                        onChange={(e) => setNewShift({...newShift, notes: e.target.value})}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsStartDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleStartShift} disabled={isProcessing}>
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        "Start Shift"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <>
                <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center space-x-2">
                      <Plus className="w-4 h-4" />
                      <span>Update Cash</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update Cash Flow</DialogTitle>
                      <DialogDescription>
                        Record cash in and cash out transactions.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cashIn">Cash In (PKR)</Label>
                          <Input
                            id="cashIn"
                            type="number"
                            placeholder="0"
                            value={updateShift.cashIn}
                            onChange={(e) => setUpdateShift({...updateShift, cashIn: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cashOut">Cash Out (PKR)</Label>
                          <Input
                            id="cashOut"
                            type="number"
                            placeholder="0"
                            value={updateShift.cashOut}
                            onChange={(e) => setUpdateShift({...updateShift, cashOut: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="Add any notes about the transaction..."
                          value={updateShift.notes}
                          onChange={(e) => setUpdateShift({...updateShift, notes: e.target.value})}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleUpdateShift} disabled={isProcessing}>
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          "Update Shift"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isEndDialogOpen} onOpenChange={setIsEndDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center space-x-2 bg-red-600 hover:bg-red-700">
                      <Square className="w-4 h-4" />
                      <span>End Shift</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>End Shift</DialogTitle>
                      <DialogDescription>
                        Complete your shift with actual cash count.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="actualBalance">Actual Balance (PKR)</Label>
                        <Input
                          id="actualBalance"
                          type="number"
                          placeholder="0"
                          value={endShift.actualBalance}
                          onChange={(e) => setEndShift({...endShift, actualBalance: e.target.value})}
                        />
                        <p className="text-sm text-muted-foreground">
                          Expected: PKR {calculateExpectedBalance().toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="Add any notes about the shift end..."
                          value={endShift.notes}
                          onChange={(e) => setEndShift({...endShift, notes: e.target.value})}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEndDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleEndShift} disabled={isProcessing}>
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Ending...
                          </>
                        ) : (
                          "End Shift"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}

            <Button
              onClick={() => {
                loadActiveShift();
                loadRecentShifts();
              }}
              disabled={isLoading || isProcessing}
              variant="outline"
              className="flex items-center space-x-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              <span>Refresh</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Shifts */}
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Recent Shifts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentShifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No recent shifts found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {formatTime(shift.startTime)}
                      </span>
                      {shift.endTime && (
                        <>
                          <span className="text-muted-foreground">-</span>
                          <span className="text-sm font-medium">
                            {formatTime(shift.endTime)}
                          </span>
                        </>
                      )}
                    </div>
                    <Badge className={getStatusColor(shift.status)}>
                      {shift.status}
                    </Badge>
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        PKR {shift.openingBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {shift.difference !== null ? `Diff: PKR ${shift.difference.toLocaleString()}` : 'Active'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {shift.notes || "No notes"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShiftManagement;
