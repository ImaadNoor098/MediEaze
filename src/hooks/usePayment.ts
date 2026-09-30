
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { toast } from '@/hooks/use-toast';
import { AddressFormData } from '@/pages/CheckoutAddress';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const usePayment = (shippingAddress?: AddressFormData) => {
  const navigate = useNavigate();
  const { cart, clearCart } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState<boolean>(false);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => {
      toast({
        title: "Payment Gateway Error",
        description: "Failed to load payment gateway. Please try again.",
        variant: "destructive"
      });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Custom payment method setter that shows apology for online payments
  const handlePaymentMethodChange = (value: string) => {
    if (value === 'razorpay' || value === 'upi') {
      toast({
        title: "Online Payments Temporarily Unavailable",
        description: "We apologize for the inconvenience. Online payments will be enabled as soon as possible. Please select Cash on Delivery for now.",
        variant: "destructive"
      });
      // Don't set the payment method, keep it empty or set to previous value
      return;
    }
    setPaymentMethod(value);
  };

  const calculateSubtotal = () => {
    return cart.items.reduce((total, item) => total + item.price * item.quantity, 0);
  };
  
  const subtotal = calculateSubtotal();
  const tax = subtotal * 0.18; // 18% GST
  const total = subtotal + tax;
  const savings = cart.items.reduce((totalSavings, item) => {
    const retailPrice = item.retailPrice || (item.price / 0.85);
    return totalSavings + (retailPrice - item.price) * item.quantity;
  }, 0);

  const handleRazorpayPayment = () => {
    if (!razorpayLoaded) {
      toast({
        title: "Payment Gateway Loading",
        description: "Please wait for the payment gateway to load.",
        variant: "destructive"
      });
      return;
    }

    const options = {
      key: 'rzp_test_9999999999',
      amount: Math.round(total * 100),
      currency: 'INR',
      name: 'MediEaze',
      description: 'Medical Equipment Purchase',
       image: '/favicon.ico',
      prefill: {
        name: shippingAddress?.fullName || '',
        email: 'customer@medieaze.com',
        contact: '9548160990'
      },
      notes: {
        address: shippingAddress ? `${shippingAddress.addressLine1}, ${shippingAddress.city}` : ''
      },
      theme: {
        color: '#3B82F6'
      },
      method: {
        upi: paymentMethod === 'upi',
        card: paymentMethod === 'razorpay',
        netbanking: paymentMethod === 'razorpay',
        wallet: paymentMethod === 'razorpay'
      },
      handler: function (response: any) {
        console.log('Payment successful:', response);
        toast({
          title: "Payment Successful!",
          description: `Payment ID: ${response.razorpay_payment_id}`,
        });
        clearCart();
        navigate('/payment-success', { 
          state: { 
            method: paymentMethod === 'upi' ? 'UPI Payment' : 'Razorpay',
            total,
            savings,
            shippingAddress,
            paymentId: response.razorpay_payment_id
          } 
        });
      },
      modal: {
        ondismiss: function() {
          toast({
            title: "Payment Cancelled",
            description: "You cancelled the payment process.",
            variant: "destructive"
          });
          setLoading(false);
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const handlePaymentProcess = async () => {
    if (!paymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please select a payment method to continue.",
        variant: "destructive"
      });
      return;
    }
    if (!shippingAddress) {
      toast({
        title: "Address Required",
        description: "Please provide a shipping address first.",
        variant: "destructive"
      });
      navigate('/checkout-address');
      return;
    }
    
    setLoading(true);
    
    console.log("Processing payment for:", { shippingAddress, paymentMethod, total });
    
    if (paymentMethod === 'cod') {
      setTimeout(() => {
        setLoading(false);
        clearCart();
        navigate('/payment-success', { 
          state: { 
            method: 'Cash on Delivery',
            total,
            savings,
            shippingAddress
          } 
        });
      }, 1500);
    } else if (paymentMethod === 'razorpay' || paymentMethod === 'upi') {
      handleRazorpayPayment();
      setLoading(false);
    }
  };

  return {
    paymentMethod,
    setPaymentMethod: handlePaymentMethodChange,
    loading,
    subtotal,
    tax,
    total,
    savings,
    handlePaymentProcess
  };
};
