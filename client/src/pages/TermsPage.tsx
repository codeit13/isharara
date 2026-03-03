import { Card, CardContent, CardHeader } from "@/components/ui/card";
import SEOHead from "@/components/SEOHead";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10" data-testid="page-terms">
      <SEOHead title="Terms & Conditions" description="Read ISHQARA's Terms and Conditions. Understand the rules for using our website and purchasing our products." canonicalPath="/terms" />
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <h1 className="font-serif text-2xl font-bold">Terms &amp; Conditions</h1>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            These Terms &amp; Conditions ("Terms") govern your use of the ISHQARA website
            (<span className="font-medium text-foreground">https://ishqara.com</span>) and your
            purchase of our products. By accessing our website or placing an order, you agree to be
            bound by these Terms.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">1. Eligibility</h2>
          <p>
            You must be at least 18 years old and capable of entering into a binding contract under
            Indian law to use this website and purchase products.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">2. Orders &amp; pricing</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>All prices are listed in Indian Rupees (INR) and inclusive of applicable taxes unless specified.</li>
            <li>
              We reserve the right to modify prices, offers, and product availability at any time
              without prior notice.
            </li>
            <li>
              An order is confirmed only after successful payment authorization (for prepaid orders)
              or our acceptance of the order (for COD orders).
            </li>
          </ul>

          <h2 className="font-semibold text-base text-foreground mt-4">3. Payments</h2>
          <p>
            Online payments are processed securely via third-party payment gateways such as
            Razorpay. By providing your payment details, you authorize us and our payment partners to
            charge the order amount. For COD orders, payment is collected at the time of delivery.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">4. Intellectual property</h2>
          <p>
            All content on this website, including logos, product images, text, and designs, is the
            intellectual property of ISHQARA or its licensors and is protected by applicable laws.
            You may not reproduce, distribute, or modify any content without our prior written
            consent.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">5. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, ISHQARA will not be liable for any indirect,
            incidental, or consequential damages arising from your use of the website or purchase of
            our products. Our total liability for any claim shall not exceed the amount paid by you
            for the specific order giving rise to the claim.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">6. Governing law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of India. Any
            disputes shall be subject to the exclusive jurisdiction of the courts at Mumbai, Maharashtra.
            India.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">7. Contact</h2>
          <p>
            For any questions about these Terms, please write to us at
            <span className="font-medium text-foreground"> ishqaraperfumes@gmail.com</span>.
          </p>

          <p className="text-xs mt-6">Last updated: {new Date().getFullYear()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
