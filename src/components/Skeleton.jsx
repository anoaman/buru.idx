export default function Skeleton({ label, chart = false }) {
  return (
    <div className="ui-skeleton" role="status" aria-live="polite">
      {label ? <p className="ui-skeleton__status">{label}</p> : <span className="sr-only">Loading</span>}
      <div className="ui-skeleton__block ui-skeleton__block--lg" />
      {chart ? <div className="ui-skeleton__block ui-skeleton__block--chart" /> : null}
      <div className="ui-skeleton__block" />
      <div className="ui-skeleton__block" />
      <div className="ui-skeleton__block" />
    </div>
  );
}
