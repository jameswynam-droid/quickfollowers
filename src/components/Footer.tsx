import logoImg from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer id="contact" className="bg-gray-900 text-gray-300 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 text-white font-bold text-lg sm:text-xl mb-3 sm:mb-4">
            <img src={logoImg} alt="QuickFollowers" className="w-12 h-12 object-contain shrink-0" width="48" height="48" loading="lazy" decoding="async" />
            <span>QuickFollowers</span>
          </div>
          <p className="text-xs sm:text-sm">The world's fastest & cheapest SMM panel. Trusted globally since 2023.</p>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-2 sm:mb-3 text-sm sm:text-base">Services</h4>
          <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
            <li>
              <a href="#services" className="hover:text-primary transition">
                Instagram
              </a>
            </li>
            <li>
              <a href="#services" className="hover:text-primary transition">
                TikTok
              </a>
            </li>
            <li>
              <a href="#services" className="hover:text-primary transition">
                YouTube
              </a>
            </li>
            <li>
              <a href="#services" className="hover:text-primary transition">
                X
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-2 sm:mb-3 text-sm sm:text-base">Support</h4>
          <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
            <li>
              <a href="#faq" className="hover:text-primary transition">
                FAQ
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:text-primary transition">
                Contact Us
              </a>
            </li>
          </ul>
        </div>
        <div className="col-span-2 md:col-span-1">
          <h4 className="font-semibold text-white mb-2 sm:mb-3 text-sm sm:text-base">Contact</h4>
          <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
            <li>
              <a
                href="https://wa.me/+2348071365600?text=Hello%20QuickFollowers"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition inline-flex items-center gap-2"
              >
                <i className="fa-brands fa-whatsapp"></i>Chat on WhatsApp
              </a>
            </li>
            <li>
              <a
                href="mailto:support@quickfollowers.online"
                className="hover:text-primary transition inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-envelope"></i>support@quickfollowers.online
              </a>
            </li>
            <li className="flex items-center gap-2">
              <i className="fa-solid fa-clock"></i>24/7 Support
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-800 mt-6 sm:mt-10 pt-4 sm:pt-6 text-center text-xs">
        © 2025 QuickFollowers. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
