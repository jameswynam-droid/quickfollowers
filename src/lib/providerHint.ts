// One stable code per upstream provider.
// The letter/number is intentionally unrelated to the provider name so
// support staff can see it in the UI without exposing the vendor.
// Senior admins decode it using the legend rendered on the Admin Panel.
const CODES: Record<string, { code: string; name: string }> = {
  owlet:        { code: "P-04", name: "Owlet" },
  smmfollows:   { code: "P-11", name: "SmmFollows" },
  followspanel: { code: "P-19", name: "Followspanel" },
};

const FALLBACK = { code: "P-00", name: "Unknown" };

function normalize(v: string | null | undefined): string {
  return String(v || "").toLowerCase().trim();
}

export const PROVIDER_HINT = {
  codeFor(providerName: string | null | undefined): string {
    const key = normalize(providerName);
    return CODES[key]?.code || FALLBACK.code;
  },
  legend(): { code: string; name: string }[] {
    return Object.values(CODES);
  },
};
