function PageHeader({ title, description, actions }) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">Modulo</p>
        <h2>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

export default PageHeader;
