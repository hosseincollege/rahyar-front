type StatusBadgeProps = {
  status: "pending" | "completed" | "cancelled";
};

const statusMap = {
  pending: {
    label: "در انتظار",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  },
  completed: {
    label: "تکمیل شده",
    className:
      "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  },
  cancelled: {
    label: "لغو شده",
    className:
      "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const item = statusMap[status];

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.className}`}>
      {item.label}
    </span>
  );
}
