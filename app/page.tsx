import Link from "next/link";

export default function Page() {
  return (
    <div>
      <p>Welcome. Go to the staking UI:</p>

      <Link
        href="/stake"
        style={{
          display: "inline-block",
          padding: "12px 18px",
          borderRadius: 10,
          background: "#6f5aff",
          color: "#fff",
          textDecoration: "none",
          fontWeight: 700,
          boxShadow: "0 4px 14px rgba(0,0,0,.2)"
        }}
        aria-label="Open staking interface"
      >
        Launch Staking
      </Link>
    </div>
  );
}
