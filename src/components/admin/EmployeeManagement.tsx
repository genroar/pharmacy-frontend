import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, 
  UserPlus, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Search,
  Edit,
  Trash2,
  Eye,
  Loader2,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  Wallet,
  Target,
  Award
} from "lucide-react";
import { apiService } from "@/services/api";

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  position: string;
  department?: string;
  salary?: number;
  hireDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | 'ON_LEAVE';
  branchId: string;
  branch: {
    id: string;
    name: string;
  };
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Attendance {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    name: string;
    employeeId: string;
    position: string;
  };
  checkIn: string;
  checkOut?: string;
  totalHours?: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE';
  notes?: string;
  createdAt: string;
}

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

interface Commission {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    name: string;
    employeeId: string;
    position: string;
  };
  period: string;
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  totalSales: number;
  totalTransactions: number;
  averageSale: number;
  baseRate: number;
  bonusRate: number;
  totalCommission: number;
  bonusAmount: number;
  totalAmount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

interface Branch {
  id: string;
  name: string;
}

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("employees");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false);
  const [isCommissionDialogOpen, setIsCommissionDialogOpen] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const roles = [
    { id: "ADMIN", label: "Admin", icon: Users, description: "Full system access" },
    { id: "MANAGER", label: "Manager", icon: Target, description: "Branch management" },
    { id: "CASHIER", label: "Cashier", icon: DollarSign, description: "Sales and billing" }
  ];

  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    position: "",
    department: "",
    salary: null as number | null,
    hireDate: new Date().toISOString().split('T')[0],
    status: "ACTIVE",
    branchId: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: ""
  });

  const [newAttendance, setNewAttendance] = useState({
    employeeId: "",
    checkIn: "",
    checkOut: "",
    status: "PRESENT",
    notes: ""
  });

  const [newShift, setNewShift] = useState({
    employeeId: "",
    shiftDate: new Date().toISOString().split('T')[0],
    startTime: "",
    endTime: "",
    openingBalance: "",
    cashIn: "",
    cashOut: "",
    notes: ""
  });

  const [newCommission, setNewCommission] = useState({
    employeeId: "",
    period: "",
    periodType: "MONTHLY",
    baseRate: "0.02",
    bonusRate: "0",
    notes: ""
  });

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      console.log('🔄 Loading employee data...');
      console.log('🔑 Token:', localStorage.getItem('token'));
      
      const [employeesResponse, branchesResponse, attendanceResponse, shiftsResponse, commissionsResponse] = await Promise.all([
        apiService.getEmployees(),
        apiService.getBranches(),
        loadAttendance(),
        loadShifts(),
        loadCommissions()
      ]);

      console.log('📊 Employees response:', employeesResponse);
      console.log('🏢 Branches response:', branchesResponse);

      if (employeesResponse.success) {
        setEmployees(employeesResponse.data.employees);
        console.log('✅ Employees loaded:', employeesResponse.data.employees);
      } else {
        console.error('❌ Failed to load employees:', employeesResponse.message);
        setError(employeesResponse.message || 'Failed to load employees');
        
        // Show sample data for testing
        const sampleEmployees: Employee[] = [
          {
            id: 'emp1',
            employeeId: 'EMP001',
            name: 'John Doe',
            email: 'john.doe@pharmacy.com',
            phone: '+1234567890',
            address: '123 Main St, City',
            position: 'Cashier',
            department: 'Sales',
            salary: 3000,
            hireDate: '2024-01-15',
            status: 'ACTIVE',
            branchId: 'branch1',
            branch: { id: 'branch1', name: 'Main Branch' },
            emergencyContactName: 'Jane Doe',
            emergencyContactPhone: '+1234567891',
            emergencyContactRelation: 'Spouse',
            isActive: true,
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
          },
          {
            id: 'emp2',
            employeeId: 'EMP002',
            name: 'Sarah Smith',
            email: 'sarah.smith@pharmacy.com',
            phone: '+1234567892',
            address: '456 Oak Ave, City',
            position: 'Manager',
            department: 'Management',
            salary: 5000,
            hireDate: '2023-06-01',
            status: 'ACTIVE',
            branchId: 'branch1',
            branch: { id: 'branch1', name: 'Main Branch' },
            emergencyContactName: 'Mike Smith',
            emergencyContactPhone: '+1234567893',
            emergencyContactRelation: 'Brother',
            isActive: true,
            createdAt: '2023-06-01T00:00:00Z',
            updatedAt: '2023-06-01T00:00:00Z'
          },
          {
            id: 'emp3',
            employeeId: 'EMP003',
            name: 'Mike Johnson',
            email: 'mike.johnson@pharmacy.com',
            phone: '+1234567894',
            address: '789 Pine St, City',
            position: 'Pharmacist',
            department: 'Pharmacy',
            salary: 6000,
            hireDate: '2023-03-10',
            status: 'ACTIVE',
            branchId: 'branch1',
            branch: { id: 'branch1', name: 'Main Branch' },
            emergencyContactName: 'Lisa Johnson',
            emergencyContactPhone: '+1234567895',
            emergencyContactRelation: 'Wife',
            isActive: true,
            createdAt: '2023-03-10T00:00:00Z',
            updatedAt: '2023-03-10T00:00:00Z'
          }
        ];
        setEmployees(sampleEmployees);
        console.log('📋 Using sample employee data for testing');
      }

      if (branchesResponse.success) {
        setBranches(branchesResponse.data.branches);
        console.log('✅ Branches loaded:', branchesResponse.data.branches);
      } else {
        console.error('❌ Failed to load branches:', branchesResponse.message);
        
        // Add sample branch data
        const sampleBranches: Branch[] = [
          { id: 'branch1', name: 'Main Branch' },
          { id: 'branch2', name: 'Downtown Branch' }
        ];
        setBranches(sampleBranches);
        console.log('🏢 Using sample branch data');
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load employee data: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttendance = async () => {
    try {
      const response = await apiService.getAttendance({
        page: 1,
        limit: 50,
        startDate: new Date().toISOString().split('T')[0]
      });
      
      if (response.success) {
        setAttendance(response.data.attendance);
      } else {
        console.error('Failed to load attendance:', response.message);
        setAttendance([]);
      }
    } catch (err) {
      console.error('Error loading attendance:', err);
      setAttendance([]);
    }
  };

  const loadShifts = async () => {
    try {
      const response = await apiService.getShifts({
        page: 1,
        limit: 50,
        startDate: new Date().toISOString().split('T')[0]
      });
      
      if (response.success) {
        setShifts(response.data.shifts);
      } else {
        console.error('Failed to load shifts:', response.message);
        setShifts([]);
      }
    } catch (err) {
      console.error('Error loading shifts:', err);
      setShifts([]);
    }
  };

  const loadCommissions = async () => {
    try {
      const response = await apiService.getCommissions({
        page: 1,
        limit: 50
      });
      
      if (response.success) {
        setCommissions(response.data.commissions);
      } else {
        console.error('Failed to load commissions:', response.message);
        setCommissions([]);
      }
    } catch (err) {
      console.error('Error loading commissions:', err);
      setCommissions([]);
    }
  };

  const handleCreateEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.position || !newEmployee.branchId) {
      alert("Please fill all required fields!");
      return;
    }

    if (branches.length === 0) {
      alert("No branches available. Please contact administrator.");
      return;
    }

    try {
      setIsLoading(true);
      console.log('Creating employee with data:', newEmployee);
      console.log('Available branches:', branches);
      const response = await apiService.createEmployee(newEmployee);
      
      if (response.success) {
        await loadData();
        setNewEmployee({
          name: "",
          email: "",
          phone: "",
          address: "",
          position: "",
          department: "",
          salary: null,
          hireDate: new Date().toISOString().split('T')[0],
          status: "ACTIVE",
          branchId: "",
          emergencyContactName: "",
          emergencyContactPhone: "",
          emergencyContactRelation: ""
        });
        setIsCreateDialogOpen(false);
        alert("Employee created successfully!");
      } else {
        console.error('Failed to create employee:', response);
        alert(response.message || "Failed to create employee");
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      alert(`Failed to create employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this employee?")) {
      try {
        setIsLoading(true);
        const response = await apiService.deleteEmployee(id);
        
        if (response.success) {
          await loadData();
          alert("Employee deleted successfully!");
        } else {
          alert(response.message || "Failed to delete employee");
        }
      } catch (error) {
        console.error('Error deleting employee:', error);
        alert("Failed to delete employee. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Users className="w-4 h-4" />;
      case "MANAGER":
        return <Target className="w-4 h-4" />;
      case "CASHIER":
        return <DollarSign className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PRESENT":
      case "COMPLETED":
      case "PAID":
        return "bg-green-100 text-green-800";
      case "ACTIVE":
      case "APPROVED":
        return "bg-blue-100 text-blue-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "ABSENT":
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === "all" || employee.branchId === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  console.log('🎯 EmployeeManagement component rendering, employees count:', employees.length);
  
  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Debug Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800">
          <strong>Debug:</strong> Component loaded. Employees: {employees.length}, Loading: {isLoading.toString()}, Error: {error || 'None'}
        </p>
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Management</h1>
          <p className="text-muted-foreground">Manage employees, attendance, shifts, and performance (Manager & Admin Access)</p>
        </div>
        <div className="flex items-center space-x-3">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:opacity-90">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>
                  Create a new employee account with role-based permissions.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="+1234567890"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="123 Main St, City"
                    value={newEmployee.address}
                    onChange={(e) => setNewEmployee({...newEmployee, address: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Position *</Label>
                  <Input
                    id="position"
                    placeholder="Cashier, Manager, etc."
                    value={newEmployee.position}
                    onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    placeholder="Sales, Admin, etc."
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary">Salary</Label>
                  <Input
                    id="salary"
                    type="number"
                    placeholder="3000"
                    value={newEmployee.salary || ''}
                    onChange={(e) => setNewEmployee({...newEmployee, salary: parseFloat(e.target.value) || null})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hireDate">Hire Date *</Label>
                  <Input
                    id="hireDate"
                    type="date"
                    value={newEmployee.hireDate}
                    onChange={(e) => setNewEmployee({...newEmployee, hireDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={newEmployee.status} onValueChange={(value) => setNewEmployee({...newEmployee, status: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                      <SelectItem value="TERMINATED">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch *</Label>
                  <Select value={newEmployee.branchId} onValueChange={(value) => setNewEmployee({...newEmployee, branchId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateEmployee} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Employee"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-soft border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-bold text-foreground">{employees.length}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Present Today</p>
                <p className="text-2xl font-bold text-green-600">{attendance.filter(a => a.status === 'PRESENT').length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Shifts</p>
                <p className="text-2xl font-bold text-blue-600">{shifts.filter(s => s.status === 'ACTIVE').length}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Commissions</p>
                <p className="text-2xl font-bold text-yellow-600">{commissions.filter(c => c.status === 'PENDING').length}</p>
              </div>
              <Award className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="employees" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Employees</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="shifts" className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>Shifts</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Performance</span>
          </TabsTrigger>
        </TabsList>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-muted-foreground">Loading employee data...</span>
            </div>
          </div>
        )}

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-6">
          {/* Search and Filters */}
          <Card className="shadow-soft border-0">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={selectedBranch === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedBranch("all")}
                  >
                    All Branches
                  </Button>
                  {branches.map((branch) => (
                    <Button
                      key={branch.id}
                      variant={selectedBranch === branch.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedBranch(branch.id)}
                    >
                      {branch.name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employees Table */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle>Employees ({filteredEmployees.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span>Loading employees...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8 text-destructive">
                  <p>{error}</p>
                  <Button onClick={loadData} className="mt-2">
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Branch</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((employee) => (
                        <tr key={employee.id} className="border-b border-border hover:bg-muted/50">
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-medium text-foreground">{employee.name}</p>
                              <p className="text-sm text-muted-foreground">{employee.email}</p>
                              <p className="text-xs text-muted-foreground">{employee.employeeId}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="outline" className="flex items-center space-x-1 w-fit">
                              <span>{employee.position}</span>
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm">{employee.branch.name}</span>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant={employee.isActive ? "default" : "secondary"}>
                              {employee.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-1">
                              <Button variant="ghost" size="sm" title="View Details">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Edit">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteEmployee(employee.id)}
                                className="text-destructive hover:text-destructive"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-6">
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Attendance Records</span>
                <Button onClick={() => setIsAttendanceDialogOpen(true)}>
                  <Clock className="w-4 h-4 mr-2" />
                  Mark Attendance
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Check In</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Check Out</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Hours</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record) => (
                      <tr key={record.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-foreground">{record.employee.name}</p>
                            <p className="text-sm text-muted-foreground">{record.employee.position}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm">{new Date(record.checkIn).toLocaleString()}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm">
                            {record.checkOut ? new Date(record.checkOut).toLocaleString() : 'Not checked out'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm font-medium">
                            {record.totalHours ? `${record.totalHours}h` : 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge className={getStatusColor(record.status)}>
                            {record.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shifts Tab */}
        <TabsContent value="shifts" className="space-y-6">
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Shift Management</span>
                <Button onClick={() => setIsShiftDialogOpen(true)}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Start Shift
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Duration</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Opening Balance</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cash Flow</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Difference</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-foreground">{shift.employee.name}</p>
                            <p className="text-sm text-muted-foreground">{shift.employee.position}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm">{new Date(shift.shiftDate).toLocaleDateString()}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm">
                            {shift.startTime && shift.endTime ? 
                              `${Math.round((new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60) * 10) / 10}h` : 
                              'Active'
                            }
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm font-medium">PKR {shift.openingBalance.toLocaleString()}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm">
                            <p className="text-green-600">+PKR {shift.cashIn.toLocaleString()}</p>
                            <p className="text-red-600">-PKR {shift.cashOut.toLocaleString()}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`text-sm font-medium ${
                            shift.difference === 0 ? 'text-green-600' : 
                            shift.difference && shift.difference > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {shift.difference !== null ? `PKR ${shift.difference.toLocaleString()}` : 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge className={getStatusColor(shift.status)}>
                            {shift.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Sales Performance & Commissions</span>
                <Button onClick={() => setIsCommissionDialogOpen(true)}>
                  <Award className="w-4 h-4 mr-2" />
                  Calculate Commission
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Period</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Total Sales</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Transactions</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Avg Sale</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Commission</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((commission) => (
                      <tr key={commission.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-foreground">{commission.employee.name}</p>
                            <p className="text-sm text-muted-foreground">{commission.employee.position}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm">{commission.period}</span>
                          <p className="text-xs text-muted-foreground">{commission.periodType}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm font-medium">PKR {commission.totalSales.toLocaleString()}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm">{commission.totalTransactions}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm">PKR {commission.averageSale.toFixed(2)}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm">
                            <p className="font-medium">PKR {commission.totalAmount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                              Base: {commission.totalCommission.toLocaleString()} + Bonus: {commission.bonusAmount.toLocaleString()}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge className={getStatusColor(commission.status)}>
                            {commission.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeManagement;
