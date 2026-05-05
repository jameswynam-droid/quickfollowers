import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";

const Terms = () => {
  useEffect(() => {
    document.title = "Terms of Service | QuickFollowers";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Terms of Service for QuickFollowers — rules for using our SMM panel, payments, refunds, and acceptable use.");
  }, []);

  const updated = "May 5, 2026";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: {updated}</p>

        <Card>
          <CardContent className="prose prose-sm sm:prose dark:prose-invert max-w-none p-6 space-y-6 text-foreground">
            <section>
              <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
              <p>By creating an account or placing an order on quickfollowers.online ("QuickFollowers", "we", "us"), you agree to these Terms of Service. If you do not agree, do not use the service.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">2. Eligibility</h2>
              <p>You must be at least 18 years old (or the age of majority in your jurisdiction) to use QuickFollowers. You are responsible for keeping your login credentials confidential.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">3. Service Description</h2>
              <p>QuickFollowers is a Social Media Marketing (SMM) panel that resells engagement-related services (followers, likes, views, comments, subscribers, and similar) for public social media accounts and content. We do not own, operate, or control the social platforms.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">4. Acceptable Use</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide accurate links to public profiles or posts.</li>
                <li>Do not order services for accounts you do not own or lack permission to promote.</li>
                <li>Do not use the service for content that is illegal, hateful, sexually explicit involving minors, or that violates the target platform's terms.</li>
                <li>Do not chargeback legitimate transactions; contact support first.</li>
                <li>Do not attempt to exploit, reverse-engineer, or attack the platform.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">5. Orders, Delivery & Drops</h2>
              <p>Delivery times are estimates, not guarantees. Social platforms periodically remove inactive or flagged accounts ("drops"), which may reduce delivered counts. Refill-eligible services are clearly marked. Non-refill services are delivered as-is.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">6. Payments & Pricing</h2>
              <p>All deposits are processed through third-party providers (Flutterwave, Paystack). Funds added to your wallet are non-refundable to the original payment method except as required by law. Prices are shown in your selected currency and may change without notice.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">7. Refunds</h2>
              <p>If an order is partially delivered, a proportional refund is automatically credited to your wallet based on the remaining quantity. Fully canceled orders are refunded in full to your wallet. Wallet balances cannot be withdrawn to a bank account.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">8. Account Suspension</h2>
              <p>We may suspend or terminate accounts that violate these Terms, abuse refunds, file fraudulent chargebacks, or engage in suspicious activity. Remaining wallet balance may be forfeited in cases of fraud.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">9. Disclaimers</h2>
              <p>QuickFollowers is provided "as is" without warranties of any kind. We are not affiliated with Instagram, TikTok, YouTube, X (Twitter), Facebook, or any other platform. We do not guarantee that delivered engagement will be retained, monetizable, or visible to other users.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">10. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, QuickFollowers' total liability for any claim is limited to the amount you paid in the 30 days preceding the claim. We are not liable for indirect, incidental, or consequential damages including lost profits or account bans by third-party platforms.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">11. Changes</h2>
              <p>We may update these Terms at any time. Continued use after changes constitutes acceptance. Material changes will be announced via dashboard notification or email.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">12. Contact</h2>
              <p>Questions? Email <a className="text-primary underline" href="mailto:support@quickfollowers.online">support@quickfollowers.online</a> or open a ticket from your dashboard.</p>
            </section>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
