export default function EmptyState({ title, message, action = null }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon text-tertiary">∅</div>
      <div className="empty-state__title">{title}</div>
      <div className="empty-state__message text-secondary">{message}</div>
      {action && (
        <div className="empty-state__action">{action}</div>
      )}
    </div>
  );
}
