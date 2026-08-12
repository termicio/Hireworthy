import Link from "next/link";
import AnimatedSection from "@/components/AnimatedSection";
import { buttonVariants } from "@/components/ui/button";

const steps = [
  { num: "01", title: "Upload your CV", desc: "Paste text or drop a PDF" },
  { num: "02", title: "Get brutally honest feedback", desc: "AI scores every section" },
  { num: "03", title: "Fix what matters", desc: "Download a tailored CV" },
];

const features = [
  { title: "CV Score", desc: "Overall score 0-100 with section breakdown" },
  { title: "Job Match", desc: "Paste any job description, see your fit percentage" },
  { title: "Auto-Tailor", desc: "AI rewrites your bullet points for the role" },
];

export default function HomePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Hero — pełny ekran */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "6rem 2rem", minHeight: "100vh" }}>
        <div style={{ maxWidth: "600px", width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
            <Link href="/review" className={buttonVariants({ variant: "primary", className: "h-auto py-4 px-8 text-sm" })}>
              Review my CV →
            </Link>
            <Link
              href="/analyse"
              className={buttonVariants({ variant: "secondary", className: "h-auto py-4 px-8 text-sm border-[#E8FF00] text-[#E8FF00] hover:bg-[#E8FF00] hover:text-[#080808]" })}
            >
              Match to a job →
            </Link>
          </div>
        </div>
      </div>

      {/* How it works */}
      <section style={{ padding: "80px 48px", borderTop: "1px solid #222222" }}>
        <AnimatedSection>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "#666666", marginBottom: "48px", textTransform: "uppercase" }}>How it works</p>
        </AnimatedSection>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "2rem" }}>
          {steps.map((step, i) => (
            <AnimatedSection key={step.num} delay={i * 120}>
              <div style={{ borderTop: "1px solid #222222", paddingTop: "32px", paddingRight: "48px" }}>
                <p style={{ fontSize: "4rem", fontWeight: 700, color: "#E8FF00", lineHeight: 1 }}>{step.num}</p>
                <p style={{ color: "#F5F5F5", fontWeight: 700, marginTop: "16px", marginBottom: "8px" }}>{step.title}</p>
                <p style={{ color: "#666666", fontSize: "0.875rem" }}>{step.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section style={{ padding: "80px 48px", borderTop: "1px solid #222222" }}>
        <AnimatedSection>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "#666666", marginBottom: "48px", textTransform: "uppercase" }}>What you get</p>
        </AnimatedSection>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "24px" }}>
          {features.map((f, i) => (
            <AnimatedSection key={f.title} delay={i * 140}>
              <div style={{ background: "#111111", border: "1px solid #222222", padding: "32px", height: "100%" }}>
                <p style={{ color: "#F5F5F5", fontWeight: 700, fontSize: "1.1rem", marginBottom: "12px" }}>{f.title}</p>
                <p style={{ color: "#666666", fontSize: "0.875rem" }}>{f.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <AnimatedSection
        style={{
          padding: "48px",
          background: "#111111",
          borderTop: "1px solid #222222",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p style={{ color: "#F5F5F5", fontSize: "1.1rem", fontWeight: 600 }}>Ready to know where you stand?</p>
        <Link href="/review" className={buttonVariants({ variant: "primary", className: "h-auto py-3.5 px-8 text-sm no-underline" })}>
          REVIEW MY CV →
        </Link>
      </AnimatedSection>
    </div>
  );
}
