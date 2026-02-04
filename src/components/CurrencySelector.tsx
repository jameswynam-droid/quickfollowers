import { useCurrency, CURRENCIES, CurrencyCode, HAMBURGER_CURRENCIES } from "@/hooks/useCurrency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CurrencySelectorProps {
  variant?: "default" | "compact" | "full";
  className?: string;
}

export const CurrencySelector = ({
  variant = "default",
  className = "",
}: CurrencySelectorProps) => {
  const { currency, setCurrency } = useCurrency();

  // For compact/default (hamburger menu): use limited set
  // For full (Account page): use all currencies
  const currencyList = variant === "full" 
    ? (Object.keys(CURRENCIES) as CurrencyCode[])
    : HAMBURGER_CURRENCIES;

  if (variant === "compact") {
    return (
      <Select value={currency} onValueChange={(val) => setCurrency(val as CurrencyCode)}>
        <SelectTrigger className={`w-24 ${className}`}>
          <SelectValue>
            {CURRENCIES[currency].symbol} {currency}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {currencyList.map((code) => (
            <SelectItem key={code} value={code}>
              {CURRENCIES[code].symbol} {code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={currency} onValueChange={(val) => setCurrency(val as CurrencyCode)}>
      <SelectTrigger className={`w-full ${className}`}>
        <SelectValue>
          {CURRENCIES[currency].symbol} {currency} - {CURRENCIES[currency].name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {currencyList.map((code) => (
          <SelectItem key={code} value={code}>
            <span className="flex items-center gap-2">
              <span className="font-mono w-6">{CURRENCIES[code].symbol}</span>
              <span>{code}</span>
              <span className="text-muted-foreground">- {CURRENCIES[code].name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
