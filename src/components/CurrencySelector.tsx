import { useCurrency, CURRENCIES, CurrencyCode } from "@/hooks/useCurrency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CurrencySelectorProps {
  variant?: "default" | "compact";
  className?: string;
}

export const CurrencySelector = ({
  variant = "default",
  className = "",
}: CurrencySelectorProps) => {
  const { currency, setCurrency } = useCurrency();

  const currencies = Object.entries(CURRENCIES) as [CurrencyCode, typeof CURRENCIES.NGN][];

  if (variant === "compact") {
    return (
      <Select value={currency} onValueChange={(val) => setCurrency(val as CurrencyCode)}>
        <SelectTrigger className={`w-24 ${className}`}>
          <SelectValue>
            {CURRENCIES[currency].symbol} {currency}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {currencies.map(([code, { symbol, name }]) => (
            <SelectItem key={code} value={code}>
              {symbol} {code}
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
        {currencies.map(([code, { symbol, name }]) => (
          <SelectItem key={code} value={code}>
            <span className="flex items-center gap-2">
              <span className="font-mono w-6">{symbol}</span>
              <span>{code}</span>
              <span className="text-muted-foreground">- {name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
