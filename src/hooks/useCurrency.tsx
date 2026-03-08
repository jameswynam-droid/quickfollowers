import { createContext, useContext, useState, useEffect, ReactNode } from "react";
 import { useExchangeRates } from "./useExchangeRates";
 import { CURRENCIES, HAMBURGER_CURRENCIES, COUNTRY_CURRENCY_MAP } from "./currencyData";
 import type { CurrencyCode } from "./currencyData";
 
 // Re-export for backwards compatibility
 export { CURRENCIES, HAMBURGER_CURRENCIES };
 export type { CurrencyCode };

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  formatPrice: (ngnAmount: number) => string;
  convertFromNGN: (ngnAmount: number) => number;
  convertToNGN: (amountInSelectedCurrency: number) => number;
  currencySymbol: string;
  userLocation: string | null;
 ratesLoading: boolean;
 lastUpdated: Date | null;
 isUsingFallback: boolean;
 refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>("NGN");
  const [userLocation, setUserLocation] = useState<string | null>(null);
 
   // Use live exchange rates
   const { getRate, isLoading: ratesLoading, lastUpdated, isUsingFallback, refreshRates } = useExchangeRates();

  useEffect(() => {
    // Check localStorage first
    const savedCurrency = localStorage.getItem("preferred_currency") as CurrencyCode;
    if (savedCurrency && CURRENCIES[savedCurrency]) {
      setCurrencyState(savedCurrency);
    } else {
      // Detect location via IP
      detectLocation();
    }
  }, []);

  const detectLocation = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      
      if (data.country_code) {
        setUserLocation(data.city || data.country_name || null);
        
        // Set currency based on country if not already saved
        const savedCurrency = localStorage.getItem("preferred_currency");
        if (!savedCurrency) {
          const detectedCurrency = COUNTRY_CURRENCY_MAP[data.country_code] || "NGN";
          setCurrencyState(detectedCurrency);
          localStorage.setItem("preferred_currency", detectedCurrency);
        }
      }
    } catch (error) {
      console.log("Could not detect location, defaulting to NGN");
    }
  };

  const setCurrency = (newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency);
    localStorage.setItem("preferred_currency", newCurrency);
  };

  const convertFromNGN = (ngnAmount: number): number => {
    const rate = getRate(currency);
    return ngnAmount * rate;
  };

  const convertToNGN = (amountInSelectedCurrency: number): number => {
    const rate = getRate(currency);
    if (!rate || rate <= 0) return amountInSelectedCurrency;
    return amountInSelectedCurrency / rate;
  };

  const formatPrice = (ngnAmount: number): string => {
    const converted = convertFromNGN(ngnAmount);
    const symbol = CURRENCIES[currency].symbol;
    
    return `${symbol}${converted.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        formatPrice,
        convertFromNGN,
        convertToNGN,
        currencySymbol: CURRENCIES[currency].symbol,
        userLocation,
         ratesLoading,
         lastUpdated,
         isUsingFallback,
         refreshRates,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
};
