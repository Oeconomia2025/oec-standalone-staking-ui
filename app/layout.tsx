export const metadata = {
  title: "Oeconomia Staking",
  description: "DooDoo Butt (DDB) staking UI",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#0b0b0b', color: '#fff' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
          <h1 style={{ margin: 0 }}>Oeconomia — Staking</h1>
          <p style={{ opacity: .75, marginTop: 4 }}>DooDoo Butt (DDB) • Sepolia</p>
          <hr style={{ borderColor: '#333', marginTop: 12, marginBottom: 12 }} />
          {children}
        </div>
      </body>
    </html>
  );
}
