function StatCard({ label, value, helper }) {
  return (
    <article className="card stat-card">
      <p className="eyebrow">{label}</p>
      <h3>{value}</h3>
      {helper ? <p className="muted">{helper}</p> : null}
    </article>
  );
}

export default StatCard;
