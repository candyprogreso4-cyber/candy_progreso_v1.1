export interface BusinessBranding {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

export type BusinessBrandingUpdate = Pick<
  BusinessBranding,
  'name' | 'business_type' | 'logo_url' | 'primary_color' | 'secondary_color'
>;
