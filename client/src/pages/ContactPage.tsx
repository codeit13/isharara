import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSettings } from "@/hooks/use-settings";
import SEOHead from "@/components/SEOHead";

export default function ContactPage() {
  const { storeEmail, storePhone } = useSettings();

  const waPhone = storePhone.replace(/\D/g, "");

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "ISHQARA",
    "url": "https://ishqara.com",
    "logo": "https://ishqara.com/logo.png",
    "image": "https://ishqara.com/og-image.png",
    "description": "Premium fragrance brand offering authentic and recreation perfumes online.",
    "telephone": storePhone,
    "email": storeEmail,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Mumbai",
      "addressRegion": "Maharashtra",
      "addressCountry": "IN",
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
      "opens": "10:00",
      "closes": "18:00",
    },
    "sameAs": ["https://www.instagram.com/ishqaraperfumes"],
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" data-testid="page-contact">
      <SEOHead
        title="Contact Us"
        description="Get in touch with ISHQARA. Reach us by phone, WhatsApp or email for orders, products, or partnership enquiries."
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
            <p>Monday to Saturday, 10:00 am – 6:00 pm IST (excluding public holidays)</p>
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">Registered address</p>
            <p>
              Mumbai, Maharashtra.<br />
              India
            </p>
          </div>

          <p className="text-xs mt-6">Last updated: {new Date().getFullYear()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
