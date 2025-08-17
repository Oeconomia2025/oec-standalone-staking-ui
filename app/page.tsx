import Link from "next/link";
export default function Page() {
  return (
    <div>
      <p>Welcome. Go to the staking UI:</p>
      <p><Link href="/stake">/stake</Link></p>
    </div>
  );
}
