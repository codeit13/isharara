import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10" data-testid="page-contact">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Contact Us</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            We would love to hear from you. For any questions about orders, products, payments, or
            partnership opportunities, please reach out using the details below.
          </p>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">Email</p>
            <p>support@ishqara.com</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">Customer care hours</p>
            <p>Monday to Saturday, 10:00 AM – 6:00 PM IST (excluding public holidays)</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">Registered address</p>
            <p>
              ISHQARA<br />
              MUNDIYA KALAN, BAZPUR<br />
              UDHAM SINGH NAGAR, UTTARAKHAND, 262401<br />
              India
            </p>
          </div>

          <p className="text-xs mt-6">Last updated: {new Date().getFullYear()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
