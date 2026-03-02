import { Card, CardContent, CardHeader } from "@/components/ui/card";
import SEOHead from "@/components/SEOHead";

export default function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10" data-testid="page-refund-policy">
      <SEOHead title="Refund & Cancellation Policy" description="Read ISHQARA's refund and cancellation policy. Learn about our return process and how to request a refund." canonicalPath="/refund-policy" />
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <h1 className="font-serif text-2xl font-bold">Refund &amp; Cancellation Policy</h1>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Due to the nature of perfume and personal care products, we follow a strict quality and
            hygiene policy. Please read the terms below carefully before placing your order.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">1. Order cancellation</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Orders can be cancelled only before they are dispatched from our warehouse.</li>
            <li>
              For prepaid orders, if a cancellation is approved, the refund will be initiated to the
              original payment method within 5-7 working days (subject to your bank/payment
              provider).
            </li>
            <li>Once an order is shipped, it cannot be cancelled.</li>
          </ul>

          <h2 className="font-semibold text-base text-foreground mt-4">2. Returns &amp; exchanges</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>
              For safety and hygiene reasons, we do not accept returns or exchanges for opened or
              used products.
            </li>
            <li>
              Returns are considered only if you receive a damaged, defective, or incorrect product
              and notify us within 24 hours of delivery with unboxing photos/videos.
            </li>
            <li>
              Products must be unused, in their original packaging, and with all labels and seals
              intact for any return to be considered.
            </li>
          </ul>

          <h2 className="font-semibold text-base text-foreground mt-4">3. Refunds for damaged / incorrect products</h2>
          <p>
            If your return request is approved for a damaged, defective, or incorrect item, we will
            either issue a replacement or process a refund to your original payment method. Shipping
            charges are generally non-refundable unless the error is on our side.
          </p>

          <h2 className="font-semibold text-base text-foreground mt-4">4. How to raise a request</h2>
          <p>
            To report an issue, please email us at
            <span className="font-medium text-foreground"> ishqaraperfumes@gmail.com</span> with your
            order ID, description of the issue, and clear photos/videos of the product and packaging.
          </p>

          <p className="text-xs mt-6">Last updated: {new Date().getFullYear()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
