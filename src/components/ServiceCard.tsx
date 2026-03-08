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
    <div className="group relative bg-card/80 dark:bg-card/60 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 p-3 sm:p-6 flex flex-col border border-border dark:border-border/80 hover:border-primary/50 overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-5">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-muted dark:bg-muted/80 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
            <i className={`${icon} ${getDarkModeIconColor(iconColor)} text-lg sm:text-2xl`}></i>
          </div>
          <h3 className="text-sm sm:text-xl font-bold text-card-foreground group-hover:text-primary transition-colors line-clamp-2">{title}</h3>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-6 flex-grow leading-relaxed line-clamp-3">{description}</p>
        <Button 
          onClick={onOrder} 
          className="w-full mt-auto group-hover:scale-105 transition-transform text-xs sm:text-sm" 
          variant="default"
          size="sm"
        >
          Order Now
          <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
        </Button>
      </div>
    </div>
  );
};

export default ServiceCard;
