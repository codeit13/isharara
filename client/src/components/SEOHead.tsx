import { Helmet } from "react-helmet-async";
import { useTenant } from "@/hooks/use-tenant";

const FALLBACK_URL = "https://ishqara.com";
const FALLBACK_NAME = "ISHQARA";

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  type?: "website" | "product" | "article";
  noIndex?: boolean;
  jsonLd?: object | object[];
}

export default function SEOHead({
  title,
  description,
  canonicalPath,
  image,
  type = "website",
  noIndex = false,
  jsonLd,
}: SEOHeadProps) {
  const tenant = useTenant();
  const siteName = tenant?.name || FALLBACK_NAME;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : FALLBACK_URL;
  const defaultImage = `${baseUrl}/og-image.png`;

  const fullTitle = `${title} | ${siteName}`;
  const canonicalUrl = canonicalPath ? `${baseUrl}${canonicalPath}` : undefined;
  const ogImage = image
    ? image.startsWith("http")
      ? image
      : `${baseUrl}${image}`
    : defaultImage;

  const ldArray = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content={title} />
      <meta property="og:type" content={type} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD structured data */}
      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
}
