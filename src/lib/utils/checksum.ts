const hashString = (input: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const buildCampaignChecksum = (payload: {
  imagePath?: string;
  captionTemplate: string;
  introText: string;
  titleText: string;
  footerText: string;
  plainTextFallback: string;
  targetIds: string[];
}): string =>
  hashString(
    JSON.stringify({
      ...payload,
      targetIds: [...payload.targetIds].sort()
    })
  );
