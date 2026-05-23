type Entitlements = {
  maxMessagesPerHour: number;
};

export const entitlementsByUserType: Record<string, Entitlements> = {
  guest: {
    maxMessagesPerHour: 10,
  },
  regular: {
    maxMessagesPerHour: 10,
  },
};
