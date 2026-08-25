import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";

const Privacy = () => {
  useEffect(() => {
    document.title = "Privacy Policy | QuickFollowers";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Privacy Policy for QuickFollowers, how we collect, use, and protect your personal data on our SMM panel.");
  }, []);

  const updated = "May 5, 2026";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: {updated}</p>

        <Card>
          <CardContent className="prose prose-sm sm:prose dark:prose-invert max-w-none p-6 space-y-6 text-foreground">
            <section>
              <h2 className="text-xl font-semibold">1. Information We Collect</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Account data:</strong> email, username, full name (if provided), hashed password.</li>
                <li><strong>Order data:</strong> the public links/usernames you submit, quantities, and chosen services.</li>
                <li><strong>Payment data:</strong> handled by Flutterwave and Paystack. We only store transaction references and amounts, never card numbers or banking credentials.</li>
                <li><strong>Technical data:</strong> IP address, browser, device, and usage logs for security and abuse prevention.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">2. How We Use Your Data</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>To process orders and payments.</li>
                <li>To authenticate your account and prevent fraud.</li>
                <li>To send transactional emails (OTP, receipts, ticket replies).</li>
                <li>To improve service quality and detect abuse.</li>
              </ul>
              <p>We do <strong>not</strong> sell your data and we do <strong>not</strong> send marketing emails without your consent.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">3. Sharing</h2>
              <p>We share only the minimum data required with: payment processors (Flutterwave, Paystack), our email delivery provider, and our upstream service suppliers (only the public link/username and quantity needed to fulfill your order). We never share your email or password with suppliers.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">4. Cookies</h2>
              <p>We use essential cookies and localStorage to keep you signed in and to remember your preferences (theme, currency). We do not use third-party advertising trackers.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">5. Security</h2>
              <p>Passwords are hashed. All traffic is encrypted with HTTPS. We use leaked-password protection (HiBP), row-level database security, and rate limiting on sensitive endpoints. Despite our efforts, no online service is 100% secure.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">6. Data Retention</h2>
              <p>Account, order, and transaction records are retained while your account is active and for a reasonable period afterward to comply with legal and accounting obligations. You may request deletion at any time (see below).</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">7. Your Rights</h2>
              <p>You may access, correct, export, or delete your personal data by emailing <a className="text-primary underline" href="mailto:support@quickfollowers.online">support@quickfollowers.online</a>. We respond within 30 days.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">8. Children</h2>
              <p>QuickFollowers is not directed to children under 18. We do not knowingly collect data from minors.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">9. Changes</h2>
              <p>We may update this Privacy Policy. Material changes will be announced via the dashboard or email.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">10. Contact</h2>
              <p>Privacy questions: <a className="text-primary underline" href="mailto:support@quickfollowers.online">support@quickfollowers.online</a></p>
            </section>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
