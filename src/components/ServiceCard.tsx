import { Button } from "@/components/ui/button";

interface ServiceCardProps {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  onOrder: () => void;
}

const ServiceCard = ({ icon, iconColor, title, description, onOrder }: ServiceCardProps) => {
  // Map platform icon colors for dark mode compatibility
  const getDarkModeIconColor = (color: string) => {
    // Replace black/slate colors that don't work in dark mode
    if (color.includes('text-black') || color.includes('text-slate-900')) {
      return 'text-foreground';
    }
    return color;
  };

  return (
    <div className="group bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col border border-border hover:border-primary/40 transition-colors duration-300">
      <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <i className={`${icon} ${getDarkModeIconColor(iconColor)} text-base sm:text-xl`}></i>
        </div>
        <h3 className="text-sm sm:text-lg font-bold text-card-foreground line-clamp-2">{title}</h3>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-5 flex-grow leading-relaxed line-clamp-3">{description}</p>
      <Button 
        onClick={onOrder} 
        className="w-full mt-auto text-xs sm:text-sm font-semibold" 
        variant="default"
        size="sm"
      >
        Order Now
        <i className="fa-solid fa-arrow-right ml-2"></i>
      </Button>
    </div>
  );
};

export default ServiceCard;
