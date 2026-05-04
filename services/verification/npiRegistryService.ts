/**
 * NPI Registry lookup — free public CMS API.
 * https://npiregistry.cms.hhs.gov/api/?version=2.1
 *
 * Returns provider info from a National Provider Identifier number, or searches by name + state.
 * No API key required. Used for cross-validating applicant-claimed credentials.
 */

const NPI_API_BASE = "https://npiregistry.cms.hhs.gov/api/?version=2.1";

export type NpiProvider = {
  npi: string;
  enumerationType: string;
  basic: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    credential?: string;
    soleProprietor?: string;
    gender?: string;
    enumerationDate?: string;
    lastUpdated?: string;
    status?: string;
    namePrefix?: string;
    nameSuffix?: string;
  };
  taxonomies?: Array<{
    code?: string;
    desc?: string;
    primary?: boolean;
    state?: string;
    license?: string;
  }>;
  addresses?: Array<{
    countryCode?: string;
    countryName?: string;
    addressPurpose?: string;
    addressType?: string;
    address1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    telephoneNumber?: string;
  }>;
};

export type NpiLookupResult = {
  found: boolean;
  resultCount: number;
  providers: NpiProvider[];
  query: { npi?: string; firstName?: string; lastName?: string; state?: string };
  fetchedAt: Date;
};

export async function lookupNpi(input: {
  npi?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  state?: string | null;
}): Promise<NpiLookupResult> {
  const params = new URLSearchParams();
  if (input.npi) {
    params.set("number", input.npi.trim());
  } else {
    if (input.firstName) params.set("first_name", input.firstName.trim());
    if (input.lastName) params.set("last_name", input.lastName.trim());
    if (input.state) params.set("state", input.state.trim());
    params.set("limit", "10");
  }

  const url = `${NPI_API_BASE}&${params.toString()}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "QualityOneCare-HR-Portal/1.0 (+verification)" }
  });
  if (!response.ok) {
    throw new Error(`NPI Registry lookup failed: HTTP ${response.status}`);
  }
  const data = await response.json() as { result_count?: number; results?: unknown[] };
  const results = Array.isArray(data.results) ? data.results : [];

  const providers: NpiProvider[] = results.map((raw) => {
    const r = raw as Record<string, unknown>;
    const basic = (r.basic ?? {}) as Record<string, unknown>;
    const taxonomies = Array.isArray(r.taxonomies) ? r.taxonomies : [];
    const addresses = Array.isArray(r.addresses) ? r.addresses : [];
    return {
      npi: String(r.number ?? ""),
      enumerationType: String(r.enumeration_type ?? ""),
      basic: {
        firstName: typeof basic.first_name === "string" ? basic.first_name : undefined,
        lastName: typeof basic.last_name === "string" ? basic.last_name : undefined,
        middleName: typeof basic.middle_name === "string" ? basic.middle_name : undefined,
        credential: typeof basic.credential === "string" ? basic.credential : undefined,
        soleProprietor: typeof basic.sole_proprietor === "string" ? basic.sole_proprietor : undefined,
        gender: typeof basic.gender === "string" ? basic.gender : undefined,
        enumerationDate: typeof basic.enumeration_date === "string" ? basic.enumeration_date : undefined,
        lastUpdated: typeof basic.last_updated === "string" ? basic.last_updated : undefined,
        status: typeof basic.status === "string" ? basic.status : undefined,
        namePrefix: typeof basic.name_prefix === "string" ? basic.name_prefix : undefined,
        nameSuffix: typeof basic.name_suffix === "string" ? basic.name_suffix : undefined
      },
      taxonomies: taxonomies.map((t) => {
        const tx = t as Record<string, unknown>;
        return {
          code: typeof tx.code === "string" ? tx.code : undefined,
          desc: typeof tx.desc === "string" ? tx.desc : undefined,
          primary: tx.primary === true,
          state: typeof tx.state === "string" ? tx.state : undefined,
          license: typeof tx.license === "string" ? tx.license : undefined
        };
      }),
      addresses: addresses.map((a) => {
        const ad = a as Record<string, unknown>;
        return {
          countryCode: typeof ad.country_code === "string" ? ad.country_code : undefined,
          countryName: typeof ad.country_name === "string" ? ad.country_name : undefined,
          addressPurpose: typeof ad.address_purpose === "string" ? ad.address_purpose : undefined,
          addressType: typeof ad.address_type === "string" ? ad.address_type : undefined,
          address1: typeof ad.address_1 === "string" ? ad.address_1 : undefined,
          city: typeof ad.city === "string" ? ad.city : undefined,
          state: typeof ad.state === "string" ? ad.state : undefined,
          postalCode: typeof ad.postal_code === "string" ? ad.postal_code : undefined,
          telephoneNumber: typeof ad.telephone_number === "string" ? ad.telephone_number : undefined
        };
      })
    };
  });

  return {
    found: providers.length > 0,
    resultCount: typeof data.result_count === "number" ? data.result_count : providers.length,
    providers,
    query: {
      npi: input.npi ?? undefined,
      firstName: input.firstName ?? undefined,
      lastName: input.lastName ?? undefined,
      state: input.state ?? undefined
    },
    fetchedAt: new Date()
  };
}
