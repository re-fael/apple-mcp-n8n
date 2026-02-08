export function assertNotEmpty<T>(value: T[], message: string): void {
  if (!value || value.length === 0) {
    throw new Error(message);
  }
}

export function assertValidDate(dateString: string | null): void {
  if (!dateString) {
    throw new Error("Expected valid date string, got null");
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
