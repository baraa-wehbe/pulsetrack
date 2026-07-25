import "./globals.css";

export const metadata = {
  title: "PulseTrack",
  description: "Remote patient monitoring for clinicians and patients.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
