 import { useState, useEffect, useCallback } from "react";
 import { CurrencyCode, CURRENCIES } from "./currencyData";
 
 const CACHE_KEY = "exchange_rates_cache";
 const CACHE_EXPIRY_KEY = "exchange_rates_expiry";
 const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
 
// API URLs (fawazahmed0/exchange-api hosted on GitHub Pages - no CSP issues)
const API_LATEST_URL = "https://latest.currency-api.pages.dev/v1/currencies";

// Helper to get previous day's date in YYYY-MM-DD format
const getPreviousDayDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
};

// Historical API URL format
const getHistoricalUrl = (date: string) => 
  `https://${date}.currency-api.pages.dev/v1/currencies`;
 
 // Fallback rates (NGN as base currency, rate = how much of target currency per 1 NGN)
 const FALLBACK_RATES: Record<string, number> = Object.fromEntries(
   Object.entries(CURRENCIES).map(([code, data]) => [code.toLowerCase(), data.rate])
 );
 
 interface CachedRates {
   rates: Record<string, number>;
   timestamp: number;
 }
 
 export const useExchangeRates = () => {
   const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
   const [isLoading, setIsLoading] = useState(false);
   const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
   const [isUsingFallback, setIsUsingFallback] = useState(true);
 
   const getCachedRates = useCallback((): CachedRates | null => {
     try {
       const cached = localStorage.getItem(CACHE_KEY);
       const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
       
       if (cached && expiry) {
         const expiryTime = parseInt(expiry, 10);
         if (Date.now() < expiryTime) {
           return {
             rates: JSON.parse(cached),
             timestamp: expiryTime - CACHE_DURATION_MS
           };
         }
       }
     } catch (error) {
       console.warn("Failed to read cached exchange rates:", error);
     }
     return null;
   }, []);
 
   const setCachedRates = useCallback((newRates: Record<string, number>) => {
     try {
       const now = Date.now();
       localStorage.setItem(CACHE_KEY, JSON.stringify(newRates));
       localStorage.setItem(CACHE_EXPIRY_KEY, (now + CACHE_DURATION_MS).toString());
     } catch (error) {
       console.warn("Failed to cache exchange rates:", error);
     }
   }, []);
 
   const fetchRates = useCallback(async () => {
     setIsLoading(true);
     
     try {
      // Try fetching latest rates first
      let response = await fetch(`${API_LATEST_URL}/ngn.json`);
       
       if (!response.ok) {
        // Fallback to previous day's rates
        console.log("Latest rates fetch failed, trying previous day...");
        const previousDate = getPreviousDayDate();
        response = await fetch(`${getHistoricalUrl(previousDate)}/ngn.json`);
        
        if (!response.ok) {
          throw new Error(`Both latest and historical API requests failed`);
        }
       }
       
       const data = await response.json();
       
       if (data && data.ngn) {
         // The API returns rates as: 1 NGN = X of other currency
         const fetchedRates: Record<string, number> = {};
         
         // Map the fetched rates to our currency codes
         Object.keys(CURRENCIES).forEach((code) => {
           const lowerCode = code.toLowerCase();
           if (data.ngn[lowerCode] !== undefined) {
             fetchedRates[lowerCode] = data.ngn[lowerCode];
           } else {
             // Fallback for currencies not in the API
             fetchedRates[lowerCode] = FALLBACK_RATES[lowerCode] || 1;
           }
         });
         
         setRates(fetchedRates);
         setCachedRates(fetchedRates);
         setLastUpdated(new Date());
         setIsUsingFallback(false);
         
         console.log("Exchange rates updated successfully from API");
       }
     } catch (error) {
       console.warn("Failed to fetch exchange rates, using fallback:", error);
       setIsUsingFallback(true);
     } finally {
       setIsLoading(false);
     }
   }, [setCachedRates]);
 
   // Get rate for a specific currency (how much of that currency per 1 NGN)
   const getRate = useCallback((currencyCode: CurrencyCode): number => {
     const lowerCode = currencyCode.toLowerCase();
     return rates[lowerCode] ?? FALLBACK_RATES[lowerCode] ?? 1;
   }, [rates]);
 
   useEffect(() => {
     // Check cache first
     const cached = getCachedRates();
     
     if (cached) {
       setRates(cached.rates);
       setLastUpdated(new Date(cached.timestamp));
       setIsUsingFallback(false);
       console.log("Using cached exchange rates");
     } else {
       // Fetch fresh rates
       fetchRates();
     }
   }, [getCachedRates, fetchRates]);
 
   return {
     rates,
     getRate,
     isLoading,
     lastUpdated,
     isUsingFallback,
     refreshRates: fetchRates
   };
 };