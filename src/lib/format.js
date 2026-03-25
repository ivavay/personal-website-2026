export function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(dateString));

  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const year = parts.find((part) => part.type === "year")?.value || "";

  return `${month}-${day}-${year}`;
}

export function formatFullDate(dateString) {
  if (!dateString) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}

export function getLocalDateInputValue(date = new Date()) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function toStoredLocalDate(dateInput) {
  if (!dateInput) {
    return null;
  }

  const [year, month, day] = dateInput.split("-").map(Number);

  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

export function makeSlug(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sortPosts(posts) {
  return [...posts].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }

    const aTimestamp = new Date(a.created_at || a.updated_at || a.published_at || 0).getTime();
    const bTimestamp = new Date(b.created_at || b.updated_at || b.published_at || 0).getTime();

    if (bTimestamp !== aTimestamp) {
      return bTimestamp - aTimestamp;
    }

    return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
  });
}
