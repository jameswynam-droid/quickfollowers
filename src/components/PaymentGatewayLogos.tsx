import React from "react";

// Flutterwave logo - orange gradient wave icon
export const FlutterwaveLogo = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#F5A623"/>
    <path 
      d="M7 10.5C8.5 8 10.5 7 12.5 7C14.5 7 16 8.5 16.5 10C17 11.5 16.5 13 15.5 14C14.5 15 13 16 11 16.5C9 17 7.5 16 7 15"
      stroke="white" 
      strokeWidth="2" 
      strokeLinecap="round"
      fill="none"
    />
    <path 
      d="M8 14.5C9 13 10.5 12.5 12 13C13.5 13.5 14 15 13.5 16"
      stroke="white" 
      strokeWidth="1.5" 
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// Paystack logo - teal/cyan P-like mark
export const PaystackLogo = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="4" fill="#00C3F7"/>
    <path 
      d="M6 7H14C15.5 7 17 8 17 9.5C17 11 15.5 12 14 12H6V7Z" 
      fill="white"
    />
    <rect x="6" y="13" width="11" height="2" rx="1" fill="white"/>
    <rect x="6" y="16" width="8" height="2" rx="1" fill="white"/>
  </svg>
);

// KoraPay logo - purple K-style mark
export const KorapayLogo = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#7C3AED"/>
    <path 
      d="M7 6V18M7 12L14 6M7 12L14 18" 
      stroke="white" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <circle cx="16" cy="6" r="2" fill="#F59E0B"/>
    <circle cx="16" cy="18" r="2" fill="#10B981"/>
  </svg>
);
