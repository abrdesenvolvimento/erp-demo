/** One OAuth navigation per page. Success stays latched until navigation unloads it. */
export function createLoginSingleFlight() {
  let pending: Promise<void> | null = null;
  return {
    isPending: () => pending !== null,
    run(task: () => Promise<void>): Promise<void> {
      if (pending) return pending;
      pending = Promise.resolve().then(task).catch(error => {
        // A preparation failure is recoverable; successful navigation must not mint another nonce.
        pending = null;
        throw error;
      });
      return pending;
    },
  };
}
