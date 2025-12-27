import logo from "@/assets/logo.png";

interface FullPageLoaderProps {
  message?: string;
}

const FullPageLoader = ({ message = "Loading..." }: FullPageLoaderProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      {/* Logo with pulse animation */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
        <img 
          src={logo} 
          alt="QuickFollowers" 
          className="relative w-16 h-16 sm:w-20 sm:h-20 animate-bounce"
          style={{ animationDuration: '1.5s' }}
        />
      </div>
      
      {/* Loading spinner */}
      <div className="relative w-12 h-12 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
      </div>
      
      {/* Loading text */}
      <p className="text-foreground/70 text-sm sm:text-base font-medium animate-pulse">
        {message}
      </p>
      
      {/* Loading dots */}
      <div className="flex gap-1.5 mt-4">
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};

export default FullPageLoader;
