const S = ({ w = "100%", h }: { w?: string; h: number }) => (
  <div className="skeleton" style={{ width: w, height: `${h}px` }} />
);

export default function SkeletonAnalyse() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 24px" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "640px" }}>
      {/* Score */}
      <div style={{ borderLeft: "2px solid #333333", paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <S w="120px" h={80} />
        <S h={4} />
      </div>

      {/* Category rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
            <S w="85%" h={10} />
          </div>
        ))}
      </div>

      {/* Keywords — two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {[0, 1].map((col) => (
          <div key={col} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <S w="100px" h={10} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {[60, 80, 50, 70].map((w, i) => <S key={i} w={`${w}px`} h={22} />)}
            </div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        <S w="100px" h={10} />
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "0", borderTop: "1px solid #1e1e1e" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ padding: "20px 0", borderBottom: "1px solid #1e1e1e", display: "flex", flexDirection: "column", gap: "8px" }}>
              <S w="90%" h={12} />
              <S w="65%" h={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
