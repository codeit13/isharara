import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSettings } from "@/hooks/use-settings";
import SEOHead from "@/components/SEOHead";

export default function ContactPage() {
  const { storeEmail, storePhone, storeName, contactAddress, contactHours, socialInstagramUrl } = useSettings();

  const waPhone = storePhone.replace(/\D/g, "");

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": storeName,
    "description": `${storeName} — contact us for any questions.`,
    "telephone": storePhone,
    "email": storeEmail,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": contactAddress,
    },
    ...(socialInstagramUrl ? { "sameAs": [socialInstagramUrl] } : {}),
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" data-testid="page-contact">
      <SEOHead
        title="Contact Us"
        description={`Get in touch with ${storeName}. Reach us by phone, WhatsApp or email for orders, products, or partnership enquiries.`}
        canonicalPath="/contact"
        jsonLd={localBusinessSchema}
      />
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <h1 className="font-serif text-2xl font-bold">Contact Us</h1>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            We would love to hear from you. For any questions about orders, products, payments, or
            partnership opportunities, please reach out using the details below.
          </p>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">Phone / WhatsApp</p>
            <p>
              <a href={`https://wa.me/${waPhone}`} className="text-primary underline underline-offset-2">
                {storePhone}
              </a>
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">Email</p>
            <p>
              <a href={`mailto:${storeEmail}`} className="text-primary underline underline-offset-2">
                {storeEmail}
              </a>
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">Customer care hours</p>
            <p>{contactHours}</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">Registered address</p>
            <p className="whitespace-pre-line">{contactAddress}</p>
          </div>

          <p className="text-xs mt-6">Last updated: {new Date().getFullYear()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
