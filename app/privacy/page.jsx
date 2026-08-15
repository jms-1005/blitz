export const metadata = {
  title: "Privacy Policy — blitz",
  description: "How blitz handles your data: your photos and videos never leave your device; we use one optional analytics cookie and Supabase for sign-in.",
  alternates: { canonical: "https://blitzluts.com/privacy/" },
};

export default function PrivacyPage() {
  return (
    <>
      <header>
        <a className="logo" href="/" aria-label="blitz home">blitz</a>
      </header>
      <main className="legal" id="main">
        <h1>Privacy Policy</h1>
        <p className="updated">Effective date: August 15, 2026 · blitzluts.com</p>

        <h2>The short version</h2>
        <p>
          Your photos and videos are never uploaded to us. All color processing in blitz happens
          locally in your browser, on your device. We collect a small amount of anonymous usage
          data (if you allow it), and basic account information if you choose to sign in. That's it.
        </p>

        <h2>Your photos and videos</h2>
        <p>
          When you use blitz to grade a photo or video, the file is opened directly in your browser
          and processed on your own device. It is not transmitted to our servers or to any third
          party. If you close the tab, it's gone. We cannot see, store, or recover your media.
        </p>

        <h2>Analytics (optional)</h2>
        <p>
          With your consent via the cookie banner, we use Google Analytics to understand how many
          people visit blitz and which features are used (for example, how many LUTs are exported).
          This involves a cookie set by Google and collection of standard usage data such as pages
          viewed, approximate location (country/city level), browser type, and anonymized
          interactions. If you decline, no analytics cookie is set. You can change your mind by
          clearing this site's data in your browser, which will show the banner again. Learn more in{" "}
          <a href="https://policies.google.com/privacy" rel="noopener noreferrer">Google's privacy policy</a>.
        </p>

        <h2>Accounts and sign-in</h2>
        <p>
          Signing in is optional and only needed for community features (publishing looks, downloads
          from the community gallery). Authentication is handled by Supabase. When you sign in with
          Google (or another provider we add), we receive your name, email address, and profile
          picture from that provider — nothing else. We use this solely to operate your blitz
          account. We do not sell or share your personal information, and we do not send marketing
          email.
        </p>

        <h2>The LUTs-served counter</h2>
        <p>
          When a LUT is exported, an anonymous counter in our database increases by one. No
          information about you or your media is attached to it.
        </p>

        <h2>Cookies and local storage</h2>
        <p>
          blitz stores your cookie-consent choice in your browser's local storage. If you consent to
          analytics, Google Analytics sets its standard cookies. If you sign in, Supabase stores an
          authentication token in your browser so you stay signed in. No advertising cookies are
          currently set; if we introduce advertising, this policy and the consent banner will be
          updated first.
        </p>

        <h2>Your rights</h2>
        <p>
          Depending on where you live (including under GDPR and CCPA), you may have rights to
          access, correct, or delete personal data we hold about you. Since the only personal data
          we hold is your account profile, you can exercise these rights by emailing us — we'll
          delete your account and associated data on request.
        </p>

        <h2>Children</h2>
        <p>blitz is not directed at children under 13, and we do not knowingly collect their data.</p>

        <h2>Changes</h2>
        <p>
          If this policy changes materially, we'll update the effective date above and note the
          change on the site.
        </p>

        <h2>Contact</h2>
        <p>
          Questions or data requests: <a href="mailto:john.manoah@gmail.com">john.manoah@gmail.com</a>
        </p>

        <p><a href="/">← Back to blitz</a></p>
      </main>
    </>
  );
}
