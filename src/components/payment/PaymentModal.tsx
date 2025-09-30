import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard,
  Smartphone,
  Building,
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield,
  Clock,
  Receipt
} from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  plan: string;
  onPaymentSuccess: (paymentData: any) => void;
}

interface PaymentData {
  method: 'easypaisa' | 'jazzcash' | 'bank';
  phoneNumber: string;
  amount: number;
  transactionId?: string;
}

const PaymentModal = ({ isOpen, onClose, amount, plan, onPaymentSuccess }: PaymentModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<'easypaisa' | 'jazzcash' | 'bank'>('easypaisa');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'method' | 'details' | 'processing' | 'success'>('method');
  const { toast } = useToast();

  const handlePayment = async () => {
    if (!phoneNumber) {
      toast({
        title: "Error",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setPaymentStep('processing');

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      const paymentData: PaymentData = {
        method: selectedMethod,
        phoneNumber,
        amount,
        transactionId: transactionId || `TXN_${Date.now()}`
      };

      // Call backend payment API
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/subscription/process-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(paymentData)
      });

      if (response.ok) {
        setPaymentStep('success');
        onPaymentSuccess(paymentData);
        toast({
          title: "Payment Successful",
          description: "Your subscription has been activated",
        });
      } else {
        throw new Error('Payment failed');
      }
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
      setPaymentStep('details');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetModal = () => {
    setPhoneNumber('');
    setTransactionId('');
    setPaymentStep('method');
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const getPaymentInstructions = () => {
    switch (selectedMethod) {
      case 'easypaisa':
        return {
          title: 'EasyPaisa Payment',
          steps: [
            '1. Open your EasyPaisa app',
            '2. Go to "Send Money"',
            '3. Enter amount: PKR ' + amount.toLocaleString(),
            '4. Send to: 0312-3456789',
            '5. Enter reference: ' + plan.toUpperCase(),
            '6. Complete transaction and enter Transaction ID below'
          ],
          icon: <Smartphone className="w-8 h-8 text-blue-600" />
        };
      case 'jazzcash':
        return {
          title: 'JazzCash Payment',
          steps: [
            '1. Open your JazzCash app',
            '2. Go to "Send Money"',
            '3. Enter amount: PKR ' + amount.toLocaleString(),
            '4. Send to: 0300-1234567',
            '5. Enter reference: ' + plan.toUpperCase(),
            '6. Complete transaction and enter Transaction ID below'
          ],
          icon: <Smartphone className="w-8 h-8 text-green-600" />
        };
      case 'bank':
        return {
          title: 'Bank Transfer',
          steps: [
            '1. Transfer PKR ' + amount.toLocaleString() + ' to:',
            '2. Bank: Allied Bank Limited',
            '3. Account: 1234567890123456',
            '4. Reference: ' + plan.toUpperCase(),
            '5. Upload receipt or enter Transaction ID'
          ],
          icon: <Building className="w-8 h-8 text-purple-600" />
        };
    }
  };

  const instructions = getPaymentInstructions();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="w-6 h-6" />
            <span>Payment for {plan} Plan</span>
          </DialogTitle>
          <DialogDescription>
            Complete your subscription payment using your preferred method
          </DialogDescription>
        </DialogHeader>

        {paymentStep === 'method' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                PKR {amount.toLocaleString()}
              </div>
              <p className="text-gray-600">Monthly subscription for {plan} plan</p>
            </div>

            <Tabs value={selectedMethod} onValueChange={(value) => setSelectedMethod(value as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="easypaisa">EasyPaisa</TabsTrigger>
                <TabsTrigger value="jazzcash">JazzCash</TabsTrigger>
                <TabsTrigger value="bank">Bank Transfer</TabsTrigger>
              </TabsList>

              <TabsContent value="easypaisa" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Smartphone className="w-5 h-5 text-blue-600" />
                      <span>EasyPaisa Payment</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Instant payment processing</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Secure and encrypted</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Immediate activation</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="jazzcash" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Smartphone className="w-5 h-5 text-green-600" />
                      <span>JazzCash Payment</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Quick and reliable</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Bank-level security</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Real-time processing</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bank" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Building className="w-5 h-5 text-purple-600" />
                      <span>Bank Transfer</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Traditional banking</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        <span className="text-sm">Bank security</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm">1-2 business days</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setPaymentStep('details')}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {paymentStep === 'details' && (
          <div className="space-y-6">
            <div className="text-center">
              {instructions.icon}
              <h3 className="text-xl font-semibold mt-2">{instructions.title}</h3>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Payment Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {instructions.steps.map((step, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <span className="text-sm font-medium text-blue-600">{step.split('.')[0]}.</span>
                      <span className="text-sm">{step.split('.').slice(1).join('.').trim()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="03XX-XXXXXXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="transactionId">Transaction ID (Optional)</Label>
                <Input
                  id="transactionId"
                  placeholder="Enter transaction ID if available"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setPaymentStep('method')}>
                Back
              </Button>
              <Button onClick={handlePayment} disabled={!phoneNumber}>
                Process Payment
              </Button>
            </div>
          </div>
        )}

        {paymentStep === 'processing' && (
          <div className="text-center space-y-6 py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600" />
            <div>
              <h3 className="text-xl font-semibold">Processing Payment</h3>
              <p className="text-gray-600 mt-2">Please wait while we process your payment...</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Amount:</strong> PKR {amount.toLocaleString()}<br />
                <strong>Method:</strong> {selectedMethod === 'easypaisa' ? 'EasyPaisa' : selectedMethod === 'jazzcash' ? 'JazzCash' : 'Bank Transfer'}<br />
                <strong>Phone:</strong> {phoneNumber}
              </p>
            </div>
          </div>
        )}

        {paymentStep === 'success' && (
          <div className="text-center space-y-6 py-8">
            <CheckCircle className="w-16 h-16 mx-auto text-green-600" />
            <div>
              <h3 className="text-2xl font-semibold text-green-600">Payment Successful!</h3>
              <p className="text-gray-600 mt-2">Your subscription has been activated</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Receipt className="w-5 h-5 text-green-600" />
                <span className="font-semibold">Transaction Details</span>
              </div>
              <p className="text-sm text-green-800">
                <strong>Amount:</strong> PKR {amount.toLocaleString()}<br />
                <strong>Plan:</strong> {plan}<br />
                <strong>Transaction ID:</strong> {transactionId || 'TXN_' + Date.now()}<br />
                <strong>Status:</strong> <Badge className="bg-green-100 text-green-800">Completed</Badge>
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
