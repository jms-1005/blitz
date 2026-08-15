import "./globals.css";
import Script from "next/script";
import CookieConsent from "../components/CookieConsent";

const GA_ID = "G-FRW4FJCGK5";

export const metadata = {
  metadataBase: new URL("https://blitzluts.com"),
  title: "blitz — Free Color Grading Online & LUT Generator | Steal Any Look",
  description:
    "Free online color grading: upload your photo or video, match the look of any reference image, and export a .cube LUT for DaVinci Resolve, Premiere Pro, Final Cut & Lightroom. No signup, runs in your browser, your media never leaves your device.",
  alternates: { canonical: "https://blitzluts.com/" },
  robots: { index: true, follow: true, "max-image-preview": "large" },
  openGraph: {
    type: "website",
    siteName: "blitz",
    title: "blitz — Steal any look. Instantly.",
    description:
      "Match your photo or video to any reference image and export a free .cube LUT for Resolve, Premiere, Final Cut & Lightroom. Runs entirely in your browser.",
    url: "https://blitzluts.com/",
    images: [{ url: "https://blitzluts.com/og-image.jpg", width: 1200, height: 630, alt: "Before and after color grading comparison made with blitz" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "blitz — Steal any look. Instantly.",
    description:
      "Free in-browser color grading and LUT export. Your shot + a reference you love = a .cube LUT for Resolve, Premiere, or Lightroom.",
    images: ["https://blitzluts.com/og-image.jpg"],
  },
  other: { "theme-color": "#0a0a0a" },
};

const jsonLdApp = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "blitz",
  url: "https://blitzluts.com/",
  description:
    "Free online color grading tool. Match your photo or video to any reference image and export the look as a .cube LUT for DaVinci Resolve, Premiere Pro, Final Cut Pro, Photoshop and Lightroom Classic.",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any (web browser)",
  browserRequirements: "Requires a modern browser with JavaScript",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Reference-based color matching for photos and video",
    "Free .cube LUT export (33-point 3D LUT)",
    "Live graded video playback and scrubbing",
    "Community look gallery previewed on your own image",
    "All processing in-browser — media never uploaded",
  ],
};

const jsonLdFaq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I copy the color grade from another photo or film still?",
      acceptedAnswer: { "@type": "Answer", text: "Upload your photo or video to blitz, then upload any reference image whose look you love. blitz statistically matches your image's colors to the reference in a perceptual color space, and you can adjust the match intensity, exposure, contrast, saturation, temperature and tint before exporting." },
    },
    {
      "@type": "Question",
      name: "Does the exported LUT work in DaVinci Resolve and Premiere Pro?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. blitz exports a standard 33-point .cube 3D LUT, which is supported by DaVinci Resolve, Premiere Pro (Lumetri Color), Final Cut Pro, Photoshop and Lightroom Classic." },
    },
    {
      "@type": "Question",
      name: "Are my photos and videos uploaded to a server?",
      acceptedAnswer: { "@type": "Answer", text: "No. All color processing happens locally in your browser. Your media never leaves your device." },
    },
    {
      "@type": "Question",
      name: "Is blitz free?",
      acceptedAnswer: { "@type": "Answer", text: "Yes — grading, the community look gallery, and .cube LUT export are free." },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      </head>
      <body>
        {children}
        <CookieConsent />
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            // Consent Mode v2: no analytics cookies until the visitor accepts
            gtag('consent', 'default', {
              analytics_storage: 'denied',
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied'
            });
            gtag('js', new Date());
            gtag('config', '${GA_ID}');`}
        </Script>
      </body>
    </html>
  );
}
