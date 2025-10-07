import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Dashboard = () => {
  const [balance] = useState(0);
  const navigate = useNavigate();

  const services = [
    {
      icon: "fa-brands fa-instagram",
      iconColor: "text-pink-600",
      title: "Instagram Service",
      description: "High-quality real-looking engagement. Instant start, 30-day refill.",
    },
    {
      icon: "fa-brands fa-tiktok",
      iconColor: "text-black",
      title: "TikTok Service",
      description: "Fast worldwide engagement. Lifetime stable, no drop.",
    },
    {
      icon: "fa-brands fa-youtube",
      iconColor: "text-red-600",
      title: "YouTube Service",
      description: "Real engagement from active accounts. Monetization safe.",
    },
    {
      icon: "fa-brands fa-x-twitter",
      iconColor: "text-slate-900",
      title: "X Service",
      description: "Aged accounts interaction. Boost your reach organically.",
    },
    {
      icon: "fa-brands fa-facebook",
      iconColor: "text-blue-600",
      title: "Facebook Service",
      description: "Worldwide page interaction. No drop, refill guaranteed.",
    },
    {
      icon: "fa-brands fa-spotify",
      iconColor: "text-green-600",
      title: "Spotify Service",
      description: "Increase plays & ranking. Premium streams available.",
    },
  ];

  const orders: any[] = [];

  const handleOrder = (title: string) => {
    toast.success(`Creating order for ${title}...`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header isAuthenticated />

      {/* Welcome / Balance Section */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="gradient-hero text-white rounded-2xl p-6 md:p-8 shadow-xl">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Welcome back!</h1>
            <p className="opacity-90 text-sm md:text-base">Your current balance:</p>
            <div className="text-4xl md:text-5xl font-extrabold mt-2">${balance.toFixed(2)}</div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={() => (window.location.href = "#deposit")}
                variant="outline"
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white"
              >
                <i className="fa-solid fa-wallet mr-2"></i>
                Deposit (Bank Transfer)
              </Button>
              <Button
                onClick={() => (window.location.href = "#services")}
                className="bg-white text-primary hover:bg-white/90 hover:text-primary"
              >
                <i className="fa-solid fa-plus mr-2"></i>
                New Order
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* New Order Section */}
      <section id="services" className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">Create New Order</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <ServiceCard key={index} {...service} onOrder={() => handleOrder(service.title)} />
            ))}
          </div>
        </div>
      </section>

      {/* My Orders Section */}
      <section id="orders" className="py-12 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6 text-center">My Orders</h2>
          <div className="bg-card rounded-2xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Order ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Service</th>
                    <th className="px-4 py-3 text-left font-semibold">Link</th>
                    <th className="px-4 py-3 text-left font-semibold">Quantity</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/20 transition">
                      <td className="px-4 py-3 font-mono">{order.id}</td>
                      <td className="px-4 py-3">{order.service}</td>
                      <td className="px-4 py-3 truncate max-w-xs" title={order.link}>
                        {order.link}
                      </td>
                      <td className="px-4 py-3">{order.quantity}</td>
                      <td className="px-4 py-3">
                        <span className={`${order.statusColor} px-3 py-1 rounded-full text-xs font-medium`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Dashboard;
