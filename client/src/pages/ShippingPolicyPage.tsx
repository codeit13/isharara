import { Card, CardContent, CardHeader } from "@/components/ui/card";
import SEOHead from "@/components/SEOHead";

export default function ShippingPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10" data-testid="page-shipping-policy">
      <SEOHead title="Shipping & Delivery Policy" description="Learn about ISHQARA's shipping and delivery timelines, charges, and free shipping offers." canonicalPath="/shipping-policy" />
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <h1 className="font-serif text-2xl font-bold">Shipping &amp; Delivery Policy</h1>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            We currently ship ISHQARA products across India using trusted courier partners. Our aim
            is to deliver your perfumes safely and on time.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">1. Dispatch &amp; delivery timelines</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Orders are typically dispatched within 1-3 working days after confirmation.</li>
            <li>
              Delivery timelines vary by location and courier partner, normally between 3-7 working
              days from dispatch.
            </li>
            <li>
              During high-volume periods (sales, festivals), dispatch and delivery may take longer
              than usual.
            </li>
          </ul>

          <h2 className="font-semibold text-base text-foreground mt-4">2. Shipping charges</h2>
          <p>
            Shipping charges, if applicable, are displayed at checkout before you confirm your
            order. We may offer free shipping above a certain order value, as mentioned on the
            website from time to time.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">3. Order tracking</h2>
          <p>
            Once your order is dispatched, you will receive an email/SMS with tracking details. You
            can also view the status of your orders in the "My Orders" section when logged in.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">4. Undelivered / returned shipments</h2>
          <p>
            If a shipment is returned to us due to incorrect address, repeated delivery attempts
            failing, or refusal to accept, we may deduct shipping and handling charges from any
            applicable refund. For COD orders, repeated non-acceptance may lead to restriction of COD
            for future orders.
          </p>

          <p className="text-xs mt-6">Last updated: {new Date().getFullYear()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
