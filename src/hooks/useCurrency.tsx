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
 // Additional currencies from supported list
  AED: { symbol: "د.إ", name: "UAE Dirham", rate: 0.0023 },
  ALL: { symbol: "L", name: "Albanian Lek", rate: 0.058 },
  AUD: { symbol: "A$", name: "Australian Dollar", rate: 0.00097 },
  BGN: { symbol: "лв", name: "Bulgarian Lev", rate: 0.0011 },
  BHD: { symbol: "ب.د", name: "Bahraini Dinar", rate: 0.00024 },
  BND: { symbol: "B$", name: "Brunei Dollar", rate: 0.00084 },
  CAD: { symbol: "C$", name: "Canadian Dollar", rate: 0.00087 },
  CHF: { symbol: "Fr", name: "Swiss Franc", rate: 0.00056 },
  CLP: { symbol: "$", name: "Chilean Peso", rate: 0.62 },
  CNY: { symbol: "¥", name: "Chinese Yuan", rate: 0.0046 },
  COP: { symbol: "$", name: "Colombian Peso", rate: 2.62 },
  CRC: { symbol: "₡", name: "Costa Rican Colón", rate: 0.32 },
  CZK: { symbol: "Kč", name: "Czech Koruna", rate: 0.015 },
  DKK: { symbol: "kr", name: "Danish Krone", rate: 0.0044 },
  DOP: { symbol: "RD$", name: "Dominican Peso", rate: 0.038 },
  DZD: { symbol: "د.ج", name: "Algerian Dinar", rate: 0.085 },
  EGP: { symbol: "E£", name: "Egyptian Pound", rate: 0.031 },
  GMD: { symbol: "D", name: "Gambian Dalasi", rate: 0.045 },
  GTQ: { symbol: "Q", name: "Guatemalan Quetzal", rate: 0.0049 },
  HKD: { symbol: "HK$", name: "Hong Kong Dollar", rate: 0.0049 },
  HNL: { symbol: "L", name: "Honduran Lempira", rate: 0.016 },
  HUF: { symbol: "Ft", name: "Hungarian Forint", rate: 0.24 },
  IDR: { symbol: "Rp", name: "Indonesian Rupiah", rate: 10.2 },
  ILS: { symbol: "₪", name: "Israeli Shekel", rate: 0.0023 },
  IQD: { symbol: "ع.د", name: "Iraqi Dinar", rate: 0.82 },
  ISK: { symbol: "kr", name: "Icelandic Króna", rate: 0.087 },
  JOD: { symbol: "د.ا", name: "Jordanian Dinar", rate: 0.00045 },
  JPY: { symbol: "¥", name: "Japanese Yen", rate: 0.097 },
  KHR: { symbol: "៛", name: "Cambodian Riel", rate: 2.56 },
  KRW: { symbol: "₩", name: "South Korean Won", rate: 0.87 },
  KWD: { symbol: "د.ك", name: "Kuwaiti Dinar", rate: 0.00019 },
  LBP: { symbol: "ل.ل", name: "Lebanese Pound", rate: 56.4 },
  LKR: { symbol: "Rs", name: "Sri Lankan Rupee", rate: 0.19 },
  LYD: { symbol: "ل.د", name: "Libyan Dinar", rate: 0.003 },
  MAD: { symbol: "د.م.", name: "Moroccan Dirham", rate: 0.0063 },
  MOP: { symbol: "MOP$", name: "Macanese Pataca", rate: 0.0051 },
  MYR: { symbol: "RM", name: "Malaysian Ringgit", rate: 0.0028 },
  NOK: { symbol: "kr", name: "Norwegian Krone", rate: 0.007 },
  NZD: { symbol: "NZ$", name: "New Zealand Dollar", rate: 0.0011 },
  OMR: { symbol: "ر.ع.", name: "Omani Rial", rate: 0.00024 },
  PAB: { symbol: "B/.", name: "Panamanian Balboa", rate: 0.00063 },
  PHP: { symbol: "₱", name: "Philippine Peso", rate: 0.036 },
  PYG: { symbol: "₲", name: "Paraguayan Guaraní", rate: 4.9 },
  QAR: { symbol: "ر.ق", name: "Qatari Riyal", rate: 0.0023 },
  RON: { symbol: "lei", name: "Romanian Leu", rate: 0.0029 },
  SAR: { symbol: "ر.س", name: "Saudi Riyal", rate: 0.0024 },
  SDD: { symbol: "ج.س.", name: "Sudanese Dinar", rate: 0.38 },
  SEK: { symbol: "kr", name: "Swedish Krona", rate: 0.0069 },
  SGD: { symbol: "S$", name: "Singapore Dollar", rate: 0.00084 },
  SLL: { symbol: "Le", name: "Sierra Leonean Leone", rate: 14.0 },
  SVC: { symbol: "$", name: "Salvadoran Colón", rate: 0.0055 },
  THB: { symbol: "฿", name: "Thai Baht", rate: 0.022 },
  TND: { symbol: "د.ت", name: "Tunisian Dinar", rate: 0.002 },
  TRY: { symbol: "₺", name: "Turkish Lira", rate: 0.021 },
  TWD: { symbol: "NT$", name: "New Taiwan Dollar", rate: 0.02 },
  UGX: { symbol: "USh", name: "Ugandan Shilling", rate: 2.32 },
  VEF: { symbol: "Bs", name: "Venezuelan Bolívar", rate: 22.8 },
  VND: { symbol: "₫", name: "Vietnamese Dong", rate: 15.9 },
  YER: { symbol: "﷼", name: "Yemeni Rial", rate: 0.16 },
  ZMK: { symbol: "ZK", name: "Zambian Kwacha (old)", rate: 3.3 },
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
  AE: "AED",
  AL: "ALL",
  AU: "AUD",
  BG: "BGN",
  BH: "BHD",
  BN: "BND",
  CA: "CAD",
  CH: "CHF",
  CL: "CLP",
  CN: "CNY",
  CO: "COP",
  CR: "CRC",
  CZ: "CZK",
  DK: "DKK",
  DO: "DOP",
  DZ: "DZD",
  EG: "EGP",
  GM: "GMD",
  GT: "GTQ",
  HK: "HKD",
  HN: "HNL",
  HU: "HUF",
  ID: "IDR",
  IL: "ILS",
  IQ: "IQD",
  IS: "ISK",
  JO: "JOD",
  JP: "JPY",
  KH: "KHR",
  KR: "KRW",
  KW: "KWD",
  LB: "LBP",
  LK: "LKR",
  LY: "LYD",
  MA: "MAD",
  MO: "MOP",
  MY: "MYR",
  NO: "NOK",
  NZ: "NZD",
  OM: "OMR",
  PA: "PAB",
  PH: "PHP",
  PY: "PYG",
  QA: "QAR",
  RO: "RON",
  SA: "SAR",
  SD: "SDD",
  SE: "SEK",
  SG: "SGD",
  SL: "SLL",
  SV: "SVC",
  TH: "THB",
  TN: "TND",
  TR: "TRY",
  TW: "TWD",
  UG: "UGX",
  VE: "VEF",
  VN: "VND",
  YE: "YER",
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
