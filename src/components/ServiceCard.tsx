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
    <div className="bg-card rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <i className={`${icon} ${iconColor} text-2xl`}></i>
        <h3 className="text-xl font-semibold text-card-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4 flex-grow">{description}</p>
      <Button onClick={onOrder} className="w-full mt-auto btn-pulse">
        Order Now
      </Button>
    </div>
  );
};

export default ServiceCard;
