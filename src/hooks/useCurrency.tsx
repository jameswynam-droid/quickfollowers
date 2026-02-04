import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// All supported currencies with exchange rates to NGN (base currency)
export const CURRENCIES = {
  NGN: { symbol: "₦", name: "Nigerian Naira", rate: 1 },
  USD: { symbol: "$", name: "US Dollar", rate: 0.00063 },
  EUR: { symbol: "€", name: "Euro", rate: 0.00058 },
  GBP: { symbol: "£", name: "British Pound", rate: 0.00050 },
  GHS: { symbol: "₵", name: "Ghanaian Cedi", rate: 0.0095 },
  KES: { symbol: "KSh", name: "Kenyan Shilling", rate: 0.081 },
  ZAR: { symbol: "R", name: "South African Rand", rate: 0.011 },
  INR: { symbol: "₹", name: "Indian Rupee", rate: 0.053 },
  TZS: { symbol: "TSh", name: "Tanzanian Shilling", rate: 1.52 },
  ZMW: { symbol: "ZK", name: "Zambian Kwacha", rate: 0.017 },
  XOF: { symbol: "CFA", name: "West African CFA Franc", rate: 0.38 },
} as const;

// Currencies shown in hamburger menu (limited set)
export const HAMBURGER_CURRENCIES: CurrencyCode[] = ["NGN", "USD", "GHS", "KES", "ZAR", "TZS", "ZMW", "XOF"];

export type CurrencyCode = keyof typeof CURRENCIES;

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  formatPrice: (ngnAmount: number) => string;
  convertFromNGN: (ngnAmount: number) => number;
  currencySymbol: string;
  userLocation: string | null;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Map countries to currencies
const COUNTRY_CURRENCY_MAP: Record<string, CurrencyCode> = {
  NG: "NGN",
  US: "USD",
  GB: "GBP",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  PT: "EUR",
  GH: "GHS",
  KE: "KES",
  ZA: "ZAR",
  IN: "INR",
  TZ: "TZS",
  ZM: "ZMW",
  CI: "XOF",
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>("NGN");
  const [userLocation, setUserLocation] = useState<string | null>(null);

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
    const rate = CURRENCIES[currency].rate;
    return ngnAmount * rate;
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
        currencySymbol: CURRENCIES[currency].symbol,
        userLocation,
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
