export default function ErrorState({ title = 'Something went wrong', error, onRetry = null }) {
  return (
    <div className="error-state">
      <div className="error-state__icon text-negative">⚠</div>
      <div className="error-state__title">{title}</div>
      {error && (
        <div className="error-state__detail text-secondary">{error}</div>
      )}
      {onRetry && (
        <button className="error-state__retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
