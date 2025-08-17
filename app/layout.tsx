import StatsBar from "@/components/StatsBar";
import "./globals.css";

export const metadata = {
  title: "Oeconomia Staking",
  description: "DooDoo Butt (DDB) staking UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0b0b0b", color: "#fff" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
          <StatsBar />
          <div style={{ marginTop: 16 }}>{children}</div>
        </div>
      </body>
    </html>
  );
}
