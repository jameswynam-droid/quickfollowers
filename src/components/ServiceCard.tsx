import { Button } from "@/components/ui/button";

interface ServiceCardProps {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  onOrder: () => void;
}

const ServiceCard = ({ icon, iconColor, title, description, onOrder }: ServiceCardProps) => {
  return (
    <div className="group relative bg-card rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 p-6 flex flex-col border border-border/50 hover:border-primary/50 overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <i className={`${icon} ${iconColor} text-2xl`}></i>
          </div>
          <h3 className="text-xl font-bold text-card-foreground group-hover:text-primary transition-colors">{title}</h3>
        </div>
        <p className="text-sm text-foreground mb-6 flex-grow leading-relaxed">{description}</p>
        <Button 
          onClick={onOrder} 
          className="w-full mt-auto group-hover:scale-105 transition-transform" 
          variant="premium"
        >
          Order Now
          <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
        </Button>
      </div>
    </div>
  );
};

export default ServiceCard;
