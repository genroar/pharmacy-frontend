import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  DollarSign,
  User,
  Calendar,
  Target,
  Award,
  BarChart3,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Eye,
  Download,
  Printer,
  Star,
  Trophy,
  Zap
} from "lucide-react";

interface CommissionRule {
  id: string;
  name: string;
  type: 'SALES_TARGET' | 'PRODUCT_COMMISSION' | 'CUSTOMER_ACQUISITION' | 'MONTHLY_BONUS';
  description: string;
  targetValue?: number;
  commissionRate?: number;
  fixedAmount?: number;
  isActive: boolean;
  createdAt: string;
}

interface CommissionEarning {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    name: string;
    position: string;
  };
  ruleId: string;
  rule: CommissionRule;
  amount: number;
  earnedAt: string;
  period: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
}

interface EmployeePerformance {
  employeeId: string;
  employee: {
    id: string;
    name: string;
    position: string;
  };
  totalSales: number;
  totalCommission: number;
  totalEarnings: number;
  salesCount: number;
  averageSaleValue: number;
  rank: number;
  achievements: string[];
}

const CommissionTracking = () => {
  const [earnings, setEarnings] = useState<CommissionEarning[]>([]);
  const [performance, setPerformance] = useState<EmployeePerformance[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [filteredEarnings, setFilteredEarnings] = useState<CommissionEarning[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedEarning, setSelectedEarning] = useState<CommissionEarning | null>(null);
  const [isEarningDialogOpen, setIsEarningDialogOpen] = useState(false);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Form states
  const [newRule, setNewRule] = useState({
    name: "",
    type: "",
    description: "",
    targetValue: "",
    commissionRate: "",
    fixedAmount: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterEarnings();
  }, [earnings, searchQuery, statusFilter, periodFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Load earnings from localStorage
      const storedEarnings = localStorage.getItem('commissionEarnings');
      if (storedEarnings) {
        try {
          const parsedEarnings = JSON.parse(storedEarnings);
          setEarnings(parsedEarnings);
        } catch (e) {
          console.warn('Error parsing stored earnings');
          setEarnings([]);
        }
      } else {
        setEarnings([]);
      }

      // Load rules from localStorage
      const storedRules = localStorage.getItem('commissionRules');
      if (storedRules) {
        try {
          const parsedRules = JSON.parse(storedRules);
          setRules(parsedRules);
        } catch (e) {
          console.warn('Error parsing stored rules');
        }
      } else {
        // Initialize with mock rules
        const mockRules: CommissionRule[] = [
          {
            id: "rule_001",
            name: "Sales Target Bonus",
            type: "SALES_TARGET",
            description: "Monthly sales target achievement bonus",
            targetValue: 100000,
            fixedAmount: 5000,
            isActive: true,
            createdAt: new Date().toISOString()
          },
          {
            id: "rule_002",
            name: "Product Commission",
            type: "PRODUCT_COMMISSION",
            description: "2% commission on all sales",
            commissionRate: 2,
            isActive: true,
            createdAt: new Date().toISOString()
          },
          {
            id: "rule_003",
            name: "Customer Acquisition",
            type: "CUSTOMER_ACQUISITION",
            description: "PKR 100 for each new customer",
            fixedAmount: 100,
            isActive: true,
            createdAt: new Date().toISOString()
          }
        ];
        setRules(mockRules);
        localStorage.setItem('commissionRules', JSON.stringify(mockRules));
      }

      // Calculate performance data
      calculatePerformance();

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePerformance = () => {
    // Mock performance data
    const mockPerformance: EmployeePerformance[] = [
      {
        employeeId: "emp_001",
        employee: { id: "emp_001", name: "Ahmad Khan", position: "Senior Cashier" },
        totalSales: 250000,
        totalCommission: 5000,
        totalEarnings: 7500,
        salesCount: 45,
        averageSaleValue: 5555.56,
        rank: 1,
        achievements: ["Top Performer", "Sales Champion", "Customer Favorite"]
      },
      {
        employeeId: "emp_002",
        employee: { id: "emp_002", name: "Fatima Ali", position: "Cashier" },
        totalSales: 180000,
        totalCommission: 3600,
        totalEarnings: 4200,
        salesCount: 32,
        averageSaleValue: 5625,
        rank: 2,
        achievements: ["Rising Star", "Consistent Performer"]
      },
      {
        employeeId: "emp_003",
        employee: { id: "emp_003", name: "Hassan Sheikh", position: "Cashier" },
        totalSales: 150000,
        totalCommission: 3000,
        totalEarnings: 3500,
        salesCount: 28,
        averageSaleValue: 5357.14,
        rank: 3,
        achievements: ["Team Player"]
      }
    ];
    setPerformance(mockPerformance);
  };

  const filterEarnings = () => {
    let filtered = [...earnings];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(earning =>
        earning.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        earning.rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        earning.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(earning => earning.status === statusFilter);
    }

    // Period filter
    if (periodFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter(earning => {
        const earningDate = new Date(earning.earnedAt);
        switch (periodFilter) {
          case "today":
            return earningDate.toDateString() === now.toDateString();
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return earningDate >= weekAgo;
          case "month":
            return earningDate.getMonth() === now.getMonth() && earningDate.getFullYear() === now.getFullYear();
          case "year":
            return earningDate.getFullYear() === now.getFullYear();
          default:
            return true;
        }
      });
    }

    setFilteredEarnings(filtered);
    setCurrentPage(1);
  };

  const createRule = async () => {
    if (!newRule.name || !newRule.type) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const ruleData: CommissionRule = {
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newRule.name,
        type: newRule.type as any,
        description: newRule.description,
        targetValue: newRule.targetValue ? parseFloat(newRule.targetValue) : undefined,
        commissionRate: newRule.commissionRate ? parseFloat(newRule.commissionRate) : undefined,
        fixedAmount: newRule.fixedAmount ? parseFloat(newRule.fixedAmount) : undefined,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // Store in localStorage
      const existingRules = JSON.parse(localStorage.getItem('commissionRules') || '[]');
      existingRules.unshift(ruleData);
      localStorage.setItem('commissionRules', JSON.stringify(existingRules));

      setRules(existingRules);
      setNewRule({ name: "", type: "", description: "", targetValue: "", commissionRate: "", fixedAmount: "" });
      setIsRuleDialogOpen(false);
      alert("Commission rule created successfully!");
    } catch (error) {
      console.error('Error creating rule:', error);
      alert("Failed to create rule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateEarningStatus = (earningId: string, newStatus: string) => {
    const updatedEarnings = earnings.map(earning =>
      earning.id === earningId
        ? {
            ...earning,
            status: newStatus as any,
            approvedAt: newStatus === 'APPROVED' ? new Date().toISOString() : earning.approvedAt,
            paidAt: newStatus === 'PAID' ? new Date().toISOString() : earning.paidAt
          }
        : earning
    );
    setEarnings(updatedEarnings);
    localStorage.setItem('commissionEarnings', JSON.stringify(updatedEarnings));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "APPROVED":
        return <Badge className="bg-blue-100 text-blue-800">Approved</Badge>;
      case "PAID":
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "SALES_TARGET":
        return <Target className="w-4 h-4" />;
      case "PRODUCT_COMMISSION":
        return <DollarSign className="w-4 h-4" />;
      case "CUSTOMER_ACQUISITION":
        return <User className="w-4 h-4" />;
      case "MONTHLY_BONUS":
        return <Award className="w-4 h-4" />;
      default:
        return <Trophy className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const paginatedEarnings = filteredEarnings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredEarnings.length / itemsPerPage);

  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading commission data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Commission & Incentive Tracking</h1>
            <p className="text-muted-foreground">Track employee commissions and performance</p>
          </div>
          <div className="flex space-x-2">
            <Button onClick={() => setIsRuleDialogOpen(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span>Total Commissions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                PKR {earnings.reduce((sum, earning) => sum + earning.amount, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5 text-blue-600" />
                <span>Active Employees</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{performance.length}</p>
              <p className="text-sm text-muted-foreground">Earning commissions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-purple-600" />
                <span>Top Performer</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-purple-600">
                {performance[0]?.employee.name || "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">
                PKR {performance[0]?.totalEarnings.toLocaleString() || "0"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-primary" />
              <span>Performance Leaderboard</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {performance.map((emp, index) => (
                <div key={emp.employeeId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-bold">
                      {emp.rank}
                    </div>
                    <div>
                      <p className="font-semibold">{emp.employee.name}</p>
                      <p className="text-sm text-muted-foreground">{emp.employee.position}</p>
                    </div>
                    <div className="flex space-x-1">
                      {emp.achievements.map((achievement, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {achievement}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      PKR {emp.totalEarnings.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {emp.salesCount} sales
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search earnings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center text-sm text-muted-foreground">
                <Filter className="w-4 h-4 mr-2" />
                {filteredEarnings.length} earning(s) found
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Earnings List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <span>Commission Earnings</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paginatedEarnings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No earnings found</p>
                <p className="text-xs">Commission earnings will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedEarnings.map((earning) => (
                  <div key={earning.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {getTypeIcon(earning.rule.type)}
                          <div>
                            <h3 className="font-semibold text-lg">{earning.rule.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {earning.employee.name} • {earning.employee.position}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(earning.status)}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          PKR {earning.amount.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(earning.earnedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                      <div className="flex items-center space-x-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>Period: {earning.period}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Award className="w-4 h-4 text-muted-foreground" />
                        <span>Type: {earning.rule.type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        <span>Description: {earning.description}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedEarning(earning);
                          setIsEarningDialogOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      {earning.status === 'PENDING' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEarningStatus(earning.id, 'APPROVED')}
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateEarningStatus(earning.id, 'CANCELLED')}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {earning.status === 'APPROVED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateEarningStatus(earning.id, 'PAID')}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredEarnings.length)} of {filteredEarnings.length} earnings
                </p>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Rule Dialog */}
        <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Commission Rule</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter rule name"
                    value={newRule.name}
                    onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Rule Type *</Label>
                  <Select value={newRule.type} onValueChange={(value) => setNewRule({...newRule, type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rule type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SALES_TARGET">Sales Target</SelectItem>
                      <SelectItem value="PRODUCT_COMMISSION">Product Commission</SelectItem>
                      <SelectItem value="CUSTOMER_ACQUISITION">Customer Acquisition</SelectItem>
                      <SelectItem value="MONTHLY_BONUS">Monthly Bonus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Enter rule description"
                  value={newRule.description}
                  onChange={(e) => setNewRule({...newRule, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetValue">Target Value</Label>
                  <Input
                    id="targetValue"
                    type="number"
                    placeholder="0"
                    value={newRule.targetValue}
                    onChange={(e) => setNewRule({...newRule, targetValue: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                  <Input
                    id="commissionRate"
                    type="number"
                    placeholder="0"
                    value={newRule.commissionRate}
                    onChange={(e) => setNewRule({...newRule, commissionRate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fixedAmount">Fixed Amount (PKR)</Label>
                  <Input
                    id="fixedAmount"
                    type="number"
                    placeholder="0"
                    value={newRule.fixedAmount}
                    onChange={(e) => setNewRule({...newRule, fixedAmount: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createRule} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Rule"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Earning Details Dialog */}
        <Dialog open={isEarningDialogOpen} onOpenChange={setIsEarningDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Earning Details</DialogTitle>
            </DialogHeader>

            {selectedEarning && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Employee Information</h3>
                    <div className="space-y-1 text-sm">
                      <p><strong>Name:</strong> {selectedEarning.employee.name}</p>
                      <p><strong>Position:</strong> {selectedEarning.employee.position}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Earning Information</h3>
                    <div className="space-y-1 text-sm">
                      <p><strong>Amount:</strong> PKR {selectedEarning.amount.toLocaleString()}</p>
                      <p><strong>Status:</strong> {selectedEarning.status}</p>
                      <p><strong>Earned At:</strong> {formatDate(selectedEarning.earnedAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Rule Details</h3>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p><strong>Rule:</strong> {selectedEarning.rule.name}</p>
                    <p><strong>Type:</strong> {selectedEarning.rule.type.replace('_', ' ')}</p>
                    <p><strong>Description:</strong> {selectedEarning.rule.description}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Additional Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Period:</strong> {selectedEarning.period}</p>
                    <p><strong>Description:</strong> {selectedEarning.description}</p>
                    {selectedEarning.approvedAt && (
                      <p><strong>Approved At:</strong> {formatDate(selectedEarning.approvedAt)}</p>
                    )}
                    {selectedEarning.paidAt && (
                      <p><strong>Paid At:</strong> {formatDate(selectedEarning.paidAt)}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CommissionTracking;
