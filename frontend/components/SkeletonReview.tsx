const S = ({ w = "100%", h }: { w?: string; h: number }) => (
  <div className="skeleton" style={{ width: w, height: `${h}px` }} />
);

export default function SkeletonReview() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 24px" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "640px" }}>
      {/* Overall score */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <S w="100px" h={10} />
        <S w="140px" h={64} />
        <S h={8} />
      </div>

      {/* Category rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <S w="140px" h={10} />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ border: "1px solid #1e1e1e", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <S w="120px" h={10} />
              <S w="28px" h={10} />
            </div>
            <S h={4} />
            <S w="80%" h={10} />
          </div>
        ))}
      </div>

      {/* Weak bullets — 3 rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <S w="140px" h={10} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "20px", borderBottom: "1px solid #1e1e1e" }}>
            <S w="50px" h={8} />
            <S w="95%" h={12} />
            <S w="50px" h={8} />
            <S w="80%" h={12} />
            <S w="50px" h={8} />
            <S w="90%" h={12} />
          </div>
        ))}
      </div>

      {/* Red flags + quick wins */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {[0, 1].map((col) => (
          <div key={col} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <S w="100px" h={10} />
            {[0, 1].map((i) => <S key={i} h={12} />)}
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
