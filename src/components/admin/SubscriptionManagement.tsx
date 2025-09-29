import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import PaymentModal from '@/components/payment/PaymentModal';
import {
  CreditCard,
  Calendar,
  DollarSign,
  Shield,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Eye,
  EyeOff,
  Star,
  Zap,
  Crown,
  Receipt
} from "lucide-react";

interface Subscription {
  id: string;
  plan: 'basic' | 'premium' | 'enterprise';
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  startDate: string;
  endDate: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  autoRenew: boolean;
  remainingDays: number;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'mobile';
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  holderName: string;
}

interface PaymentHistory {
  id: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  method: string;
  date: string;
  invoiceNumber: string;
  description: string;
}

const SubscriptionManagement = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [isEditCardOpen, setIsEditCardOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<PaymentMethod | null>(null);
  const [showCardDetails, setShowCardDetails] = useState<{ [key: string]: boolean }>({});
  const [newCardData, setNewCardData] = useState({
    type: 'card' as 'card' | 'bank' | 'mobile',
    last4: '',
    brand: '',
    expiryMonth: 0,
    expiryYear: 0,
    holderName: '',
    isDefault: false
  });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ plan: string; amount: number } | null>(null);
  const { toast } = useToast();

  // Load subscription data from API
  useEffect(() => {
    const loadSubscriptionData = async () => {
      setIsLoading(true);
      try {
        const [subscriptionResponse, paymentMethodsResponse, billingHistoryResponse] = await Promise.all([
          apiService.getSubscription(),
          apiService.getPaymentMethods(),
          apiService.getBillingHistory()
        ]);

        if (subscriptionResponse.success) {
          setSubscription(subscriptionResponse.data);
        }

        if (paymentMethodsResponse.success) {
          setPaymentMethods(paymentMethodsResponse.data);
        }

        if (billingHistoryResponse.success) {
          setPaymentHistory(billingHistoryResponse.data);
        }
      } catch (error) {
        console.error('Error loading subscription data:', error);
        toast({
          title: "Error",
          description: "Failed to load subscription data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptionData();
  }, [toast]);

  const handlePaymentSuccess = (paymentData: any) => {
    // Update subscription status after successful payment
    if (subscription) {
      setSubscription({
        ...subscription,
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Add to payment history
    const newPayment: PaymentHistory = {
      id: paymentData.transactionId,
      amount: paymentData.amount,
      status: 'success',
      method: paymentData.method === 'easypaisa' ? 'EasyPaisa' : paymentData.method === 'jazzcash' ? 'JazzCash' : 'Bank Transfer',
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: `INV-${Date.now()}`,
      description: `${selectedPlan?.plan} Plan - Monthly`
    };

    setPaymentHistory(prev => [newPayment, ...prev]);
    setIsPaymentModalOpen(false);
    setSelectedPlan(null);
  };

  const handleUpgradePlan = (plan: string, amount: number) => {
    setSelectedPlan({ plan, amount });
    setIsPaymentModalOpen(true);
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'basic': return <Shield className="w-5 h-5" />;
      case 'premium': return <Zap className="w-5 h-5" />;
      case 'enterprise': return <Crown className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'basic': return 'bg-blue-100 text-blue-800';
      case 'premium': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'expired': return <AlertCircle className="w-4 h-4" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const toggleCardVisibility = (cardId: string) => {
    setShowCardDetails(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const handleAddPaymentMethod = async () => {
    try {
      // Validate form data
      if (!newCardData.last4 || !newCardData.brand || !newCardData.holderName || !newCardData.expiryMonth || !newCardData.expiryYear) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      const response = await apiService.addPaymentMethod(newCardData);

      if (response.success) {
        // Add the new payment method to the list
        setPaymentMethods(prev => [...prev, response.data]);

        // Reset form
        setNewCardData({
          type: 'card',
          last4: '',
          brand: '',
          expiryMonth: 0,
          expiryYear: 0,
          holderName: '',
          isDefault: false
        });

        setIsAddCardOpen(false);

        toast({
          title: "Success",
          description: "Payment method added successfully",
        });
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to add payment method",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error adding payment method:', error);
      toast({
        title: "Error",
        description: "Failed to add payment method",
        variant: "destructive",
      });
    }
  };

  const handleEditCard = (card: PaymentMethod) => {
    setEditingCard(card);
    setNewCardData({
      type: card.type,
      last4: card.last4,
      brand: card.brand,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      holderName: card.holderName,
      isDefault: card.isDefault
    });
    setIsEditCardOpen(true);
  };

  const handleUpdateCard = async () => {
    if (!editingCard) return;

    try {
      // In a real app, you would call an update API
      // For now, we'll just update the local state
      setPaymentMethods(prev =>
        prev.map(method =>
          method.id === editingCard.id
            ? { ...method, ...newCardData }
            : method
        )
      );

      setIsEditCardOpen(false);
      setEditingCard(null);

      toast({
        title: "Success",
        description: "Payment method updated successfully",
      });
    } catch (error) {
      console.error('Error updating payment method:', error);
      toast({
        title: "Error",
        description: "Failed to update payment method",
        variant: "destructive",
      });
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      const response = await apiService.setDefaultPaymentMethod(methodId);

      if (response.success) {
        setPaymentMethods(prev =>
          prev.map(method => ({
            ...method,
            isDefault: method.id === methodId
          }))
        );
        toast({
          title: "Success",
          description: "Default payment method updated",
        });
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to update default payment method",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error setting default payment method:', error);
      toast({
        title: "Error",
        description: "Failed to update default payment method",
        variant: "destructive",
      });
    }
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    try {
      const response = await apiService.deletePaymentMethod(methodId);

      if (response.success) {
        setPaymentMethods(prev => prev.filter(method => method.id !== methodId));
        toast({
          title: "Success",
          description: "Payment method removed",
        });
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to remove payment method",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting payment method:', error);
      toast({
        title: "Error",
        description: "Failed to remove payment method",
        variant: "destructive",
      });
    }
  };

  const handleDownloadInvoice = (invoiceNumber: string) => {
    // In real app, this would download the actual invoice
    toast({
      title: "Download Invoice",
      description: `Downloading ${invoiceNumber}...`,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">Loading subscription data...</p>
              <p className="text-sm text-gray-500">Please wait while we fetch your subscription information</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
            <p className="text-gray-600 mt-1">Manage your subscription, payment methods, and billing</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" className="shadow-soft border-0">
              <Download className="w-4 h-4 mr-2" />
              Download Invoice
            </Button>
            <Button className="shadow-soft bg-[#0c2c8a] hover:bg-transparent hover:text-[#0c2c8a] border-[1px] border-[#0c2c8a] hover:opacity-90">
              <Edit className="w-4 h-4 mr-2" />
              Update Plan
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 shadow-soft border-0">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#0C2C8A] data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
          <TabsTrigger value="payment-methods" className="data-[state=active]:bg-[#0C2C8A] data-[state=active]:text-primary-foreground">Payment Methods</TabsTrigger>
          <TabsTrigger value="billing-history" className="data-[state=active]:bg-[#0C2C8A] data-[state=active]:text-primary-foreground">Billing History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Current Subscription */}
          <Card className="shadow-soft border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-3 text-xl">
                <div className="p-2 bg-[#0C2C8A]/10 rounded-lg">
                  <CreditCard className="w-6 h-6 text-[#0C2C8A]" />
                </div>
                <span>Current Subscription</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {subscription && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Plan</Label>
                    <div className="flex items-center space-x-2">
                      {getPlanIcon(subscription.plan)}
                      <Badge className={`${getPlanColor(subscription.plan)}`}>
                        {subscription.plan.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(subscription.status)}
                      <Badge className={`${getStatusColor(subscription.status)}`}>
                        {subscription.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Amount</Label>
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <span className="text-lg font-semibold">PKR {subscription.amount.toLocaleString()}</span>
                      <span className="text-sm text-gray-500">/{subscription.billingCycle}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500">Remaining Days</Label>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-lg font-semibold">{subscription.remainingDays}</span>
                      <span className="text-sm text-gray-500">days</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-soft border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Subscription Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscription && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Start Date:</span>
                      <span className="font-medium">{subscription.startDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">End Date:</span>
                      <span className="font-medium">{subscription.endDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Billing Cycle:</span>
                      <span className="font-medium capitalize">{subscription.billingCycle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Auto Renewal:</span>
                      <Badge className={subscription.autoRenew ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {subscription.autoRenew ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Plan Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscription?.plan === 'premium' && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Up to 50 users</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">3 branches</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Advanced reporting</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Priority support</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">API access</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Plans */}
            <Card className="shadow-soft border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Available Plans</CardTitle>
                <p className="text-sm text-gray-600">Choose a plan that fits your needs</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Basic Plan */}
                  <Card className="border-2 border-blue-200 hover:border-blue-300 transition-colors">
                    <CardHeader>
                      <CardTitle className="text-blue-600 flex items-center space-x-2">
                        <Shield className="w-5 h-5" />
                        <span>Basic Plan</span>
                      </CardTitle>
                      <div className="text-3xl font-bold">PKR 5,000<span className="text-sm font-normal">/month</span></div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm mb-4">
                        <li>• Up to 10 users</li>
                        <li>• 1 branch</li>
                        <li>• Basic reporting</li>
                        <li>• Email support</li>
                      </ul>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => handleUpgradePlan('Basic', 5000)}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay with EasyPaisa/JazzCash
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Premium Plan */}
                  <Card className="border-2 border-purple-200 hover:border-purple-300 transition-colors">
                    <CardHeader>
                      <CardTitle className="text-purple-600 flex items-center space-x-2">
                        <Zap className="w-5 h-5" />
                        <span>Premium Plan</span>
                      </CardTitle>
                      <div className="text-3xl font-bold">PKR 10,000<span className="text-sm font-normal">/month</span></div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm mb-4">
                        <li>• Up to 50 users</li>
                        <li>• 3 branches</li>
                        <li>• Advanced reporting</li>
                        <li>• Priority support</li>
                      </ul>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => handleUpgradePlan('Premium', 10000)}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay with EasyPaisa/JazzCash
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Enterprise Plan */}
                  <Card className="border-2 border-orange-200 hover:border-orange-300 transition-colors">
                    <CardHeader>
                      <CardTitle className="text-orange-600 flex items-center space-x-2">
                        <Crown className="w-5 h-5" />
                        <span>Enterprise Plan</span>
                      </CardTitle>
                      <div className="text-3xl font-bold">PKR 20,000<span className="text-sm font-normal">/month</span></div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm mb-4">
                        <li>• Unlimited users</li>
                        <li>• Unlimited branches</li>
                        <li>• Custom reporting</li>
                        <li>• 24/7 support</li>
                      </ul>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => handleUpgradePlan('Enterprise', 20000)}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay with EasyPaisa/JazzCash
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payment-methods" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Payment Methods</h3>
            <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-soft bg-[#0c2c8a] hover:bg-transparent hover:text-[#0c2c8a] border-[1px] border-[#0c2c8a] hover:opacity-90">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Payment Method
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Payment Method</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Card Brand</Label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={newCardData.brand}
                      onChange={(e) => setNewCardData(prev => ({ ...prev, brand: e.target.value }))}
                    >
                      <option value="">Select Brand</option>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="American Express">American Express</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Last 4 Digits</Label>
                    <Input
                      placeholder="1234"
                      value={newCardData.last4}
                      onChange={(e) => setNewCardData(prev => ({ ...prev, last4: e.target.value }))}
                      maxLength={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Expiry Month</Label>
                      <select
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={newCardData.expiryMonth}
                        onChange={(e) => setNewCardData(prev => ({ ...prev, expiryMonth: parseInt(e.target.value) }))}
                      >
                        <option value={0}>Select Month</option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {String(i + 1).padStart(2, '0')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Year</Label>
                      <select
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={newCardData.expiryYear}
                        onChange={(e) => setNewCardData(prev => ({ ...prev, expiryYear: parseInt(e.target.value) }))}
                      >
                        <option value={0}>Select Year</option>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cardholder Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={newCardData.holderName}
                      onChange={(e) => setNewCardData(prev => ({ ...prev, holderName: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={newCardData.isDefault}
                      onChange={(e) => setNewCardData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    />
                    <Label htmlFor="isDefault">Set as default payment method</Label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsAddCardOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddPaymentMethod}>
                      Add Card
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit Card Dialog */}
          <Dialog open={isEditCardOpen} onOpenChange={setIsEditCardOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Payment Method</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Card Brand</Label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={newCardData.brand}
                    onChange={(e) => setNewCardData(prev => ({ ...prev, brand: e.target.value }))}
                  >
                    <option value="">Select Brand</option>
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="American Express">American Express</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Last 4 Digits</Label>
                  <Input
                    placeholder="1234"
                    value={newCardData.last4}
                    onChange={(e) => setNewCardData(prev => ({ ...prev, last4: e.target.value }))}
                    maxLength={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Expiry Month</Label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={newCardData.expiryMonth}
                      onChange={(e) => setNewCardData(prev => ({ ...prev, expiryMonth: parseInt(e.target.value) }))}
                    >
                      <option value={0}>Select Month</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {String(i + 1).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Year</Label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={newCardData.expiryYear}
                      onChange={(e) => setNewCardData(prev => ({ ...prev, expiryYear: parseInt(e.target.value) }))}
                    >
                      <option value={0}>Select Year</option>
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() + i;
                        return (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cardholder Name</Label>
                  <Input
                    placeholder="John Doe"
                    value={newCardData.holderName}
                    onChange={(e) => setNewCardData(prev => ({ ...prev, holderName: e.target.value }))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isDefaultEdit"
                    checked={newCardData.isDefault}
                    onChange={(e) => setNewCardData(prev => ({ ...prev, isDefault: e.target.checked }))}
                  />
                  <Label htmlFor="isDefaultEdit">Set as default payment method</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsEditCardOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateCard}>
                    Update Card
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paymentMethods.map((method) => (
              <Card key={method.id} className="shadow-soft border-0 hover:shadow-lg transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-[#0C2C8A]/10 rounded-lg">
                        <CreditCard className="w-5 h-5 text-[#0C2C8A]" />
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">{method.brand} ****{method.last4}</span>
                        {method.isDefault && (
                          <Badge className="ml-2 bg-[#0C2C8A]/10 text-[#0C2C8A] border-0">Default</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCardVisibility(method.id)}
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                      >
                        {showCardDetails[method.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCard(method)}
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePaymentMethod(method.id)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Cardholder:</span>
                      <span className="text-sm font-medium text-gray-900">{method.holderName || '--'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Expires:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {method.expiryMonth ? method.expiryMonth.toString().padStart(2, '0') : '--'}/{method.expiryYear || '--'}
                      </span>
                    </div>
                    {showCardDetails[method.id] && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Full Number:</span>
                          <span className="text-sm font-mono text-gray-900">
                            {method.brand === 'Visa' ? '4' : '5'}*** **** **** {method.last4 || '----'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {!method.isDefault && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                        className="w-full shadow-soft border-0 bg-[#1a3ea3] hover:bg-[#1a3ea3] text-white  border-[1px] border-[#0C2C8A] "
                      >
                        Set as Default
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Billing History Tab */}
        <TabsContent value="billing-history" className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-900">Billing History</h3>

          <div className="space-y-4">
            {paymentHistory.map((payment) => (
              <Card key={payment.id} className="shadow-soft border-0 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-[#0C2C8A]/10 rounded-lg flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-[#0C2C8A]" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{payment.description}</p>
                        <p className="text-sm text-gray-600">
                          {payment.date} • {payment.method}
                        </p>
                        <p className="text-xs text-gray-500">Invoice: {payment.invoiceNumber}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">PKR {payment.amount.toLocaleString()}</p>
                        <Badge className={
                          payment.status === 'success'
                            ? 'bg-green-100 text-green-800 border-0'
                            : payment.status === 'failed'
                            ? 'bg-red-100 text-red-800 border-0'
                            : 'bg-yellow-100 text-yellow-800 border-0'
                        }>
                          {payment.status.toUpperCase()}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadInvoice(payment.invoiceNumber)}
                        className="shadow-soft border-0 hover:bg-primary hover:text-primary-foreground"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Payment Modal */}
      {selectedPlan && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedPlan(null);
          }}
          amount={selectedPlan.amount}
          plan={selectedPlan.plan}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default SubscriptionManagement;
