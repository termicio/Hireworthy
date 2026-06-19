import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}
    >
      <div style={{ maxWidth: "600px", width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", color: "#666666", textTransform: "uppercase" }}>
          Honest AI feedback on your CV. Know what to fix, fast.
        </p>
        <h1
          className="font-display font-bold uppercase"
          style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#F5F5F5", lineHeight: 1.1 }}
        >
          Know exactly where your CV stands
        </h1>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/review"
            className="uppercase tracking-widest font-bold text-sm px-8 py-4"
            style={{ background: "#E8FF00", color: "#080808" }}
          >
            Review my CV →
          </Link>
          <Link
            href="/analyse"
            className="uppercase tracking-widest font-bold text-sm px-8 py-4"
            style={{ border: "1px solid #E8FF00", color: "#E8FF00" }}
          >
            Match to a job →
          </Link>
        </div>
      </div>
    </main>
  );
}
