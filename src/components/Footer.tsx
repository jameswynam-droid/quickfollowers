const Footer = () => {
  return (
    <footer id="contact" className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 text-white font-bold text-xl mb-4">
            <i className="fa-solid fa-bolt text-primary"></i>
            QuickFollowers
          </div>
          <p className="text-sm">The fastest & cheapest SMM panel in Nigeria. Since 2023.</p>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3">Services</h4>
          <ul className="space-y-2 text-sm">
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
          <h4 className="font-semibold text-white mb-3">Support</h4>
          <ul className="space-y-2 text-sm">
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
            <li>
              <a href="#" className="hover:text-primary transition">
                Terms
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-primary transition">
                Privacy
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3">Contact</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="https://wa.me/+2349112484106"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition"
              >
                <i className="fa-brands fa-whatsapp mr-2"></i>Chat on WhatsApp
              </a>
            </li>
            <li>
              <i className="fa-solid fa-clock mr-2"></i>24/7 Support
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-800 mt-10 pt-6 text-center text-xs">
        © 2025 QuickFollowers. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
