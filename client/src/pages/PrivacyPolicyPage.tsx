import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SEOHead from "@/components/SEOHead";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10" data-testid="page-privacy">
      <SEOHead title="Privacy Policy" description="Read ISHQARA's Privacy Policy. Learn how we collect, use, and protect your personal information." canonicalPath="/privacy-policy" />
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <h1 className="font-serif text-2xl font-bold">Privacy Policy</h1>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            At ISHQARA ("we", "us", "our"), we are committed to protecting your privacy. This
            Privacy Policy explains how we collect, use, and safeguard your information when you
            visit our website and purchase our products.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">1. Information we collect</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Contact details such as name, email address, phone number, and shipping address.</li>
            <li>Order details including products purchased, quantities, and transaction value.</li>
            <li>
              Payment information processed securely by our payment partners (for example, Razorpay);
              we do not store your full card or UPI details on our servers.
            </li>
            <li>
              Technical data such as IP address, device information, and cookies to improve website
              performance and security.
            </li>
          </ul>

          <h2 className="font-semibold text-base text-foreground mt-4">2. How we use your information</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To process, fulfill, and deliver your orders.</li>
            <li>To send order confirmations, shipping updates, and support communication.</li>
            <li>To prevent fraud, enhance security, and comply with applicable laws.</li>
            <li>To improve our products, services, and website experience.</li>
            <li>
              To send marketing communication about offers and new launches, only if you have
              consented. You can opt out at any time using the unsubscribe link or by contacting us.
            </li>
          </ul>

          <h2 className="font-semibold text-base text-foreground mt-4">3. Sharing of information</h2>
          <p>
            We do not sell or rent your personal information. We may share limited information with
            trusted service providers who help us operate our business, such as payment gateways,
            couriers, and marketing tools, strictly for the purpose of providing services to you.
            These partners are bound by confidentiality obligations.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">4. Data security</h2>
          <p>
            We use reasonable technical and organizational measures to protect your information from
            unauthorized access, alteration, or disclosure. However, no method of transmission over
            the internet is 100% secure, so we cannot guarantee absolute security.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">5. Your rights</h2>
          <p>
            You may request access, correction, or deletion of your personal information subject to
            applicable law. To exercise these rights, please reach out to us using the contact
            details below.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">6. Contact us</h2>
          <p>
            If you have any questions about this Privacy Policy or how we handle your data, please
            email us at <span className="font-medium text-foreground">ishqaraperfumes@gmail.com</span>.
          </p>

          <p className="text-xs mt-6">Last updated: {new Date().getFullYear()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
