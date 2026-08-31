import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_ADDRESS_COUNTRY,
  ETHIOPIA_CITIES,
  formatAddress,
  formatPhone,
  parseAddress,
  parsePhone,
  PHONE_COUNTRIES,
  type ParsedAddress,
  type ParsedPhone,
} from "@/lib/contact-format";

const OTHER_CITY = "__other__";

function AddressFields({
  value,
  onChange,
}: {
  value: ParsedAddress;
  onChange: (address: string) => void;
}) {
  const isEthiopia = value.country === DEFAULT_ADDRESS_COUNTRY;
  const citySelectValue =
    isEthiopia && value.city && !ETHIOPIA_CITIES.includes(value.city as (typeof ETHIOPIA_CITIES)[number])
      ? OTHER_CITY
      : value.city;

  const patch = (next: Partial<ParsedAddress>) => onChange(formatAddress({ ...value, ...next }));

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="address-country">
            Country <span className="text-muted-foreground">*</span>
          </Label>
          <Select value={value.country} onValueChange={(country) => patch({ country, city: "" })}>
            <SelectTrigger id="address-country">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              {PHONE_COUNTRIES.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address-city">
            City / region <span className="text-muted-foreground">*</span>
          </Label>
          {isEthiopia ? (
            <>
              <Select
                value={citySelectValue || undefined}
                onValueChange={(city) =>
                  patch({ city: city === OTHER_CITY ? "" : city, details: value.details })
                }
              >
                <SelectTrigger id="address-city">
                  <SelectValue placeholder="Choose a city" />
                </SelectTrigger>
                <SelectContent>
                  {ETHIOPIA_CITIES.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_CITY}>Other…</SelectItem>
                </SelectContent>
              </Select>
              {citySelectValue === OTHER_CITY && (
                <Input
                  autoComplete="address-level2"
                  placeholder="City or town"
                  value={value.city}
                  onChange={(e) => patch({ city: e.target.value })}
                />
              )}
            </>
          ) : (
            <Input
              id="address-city"
              autoComplete="address-level2"
              placeholder="City or region"
              value={value.city}
              onChange={(e) => patch({ city: e.target.value })}
            />
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address-details">
          Street or neighborhood <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="address-details"
          name="street-address"
          autoComplete="street-address"
          placeholder="e.g. Kebele 03, Bole"
          value={value.details}
          onChange={(e) => patch({ details: e.target.value })}
        />
      </div>
      {value.country && value.city && (
        <p className="text-xs text-muted-foreground">Saved as: {formatAddress(value)}</p>
      )}
    </div>
  );
}

function PhoneField({ value, onChange }: { value: ParsedPhone; onChange: (phone: string) => void }) {
  const country = PHONE_COUNTRIES.find((c) => c.id === value.countryId) ?? PHONE_COUNTRIES[0]!;

  const patch = (next: Partial<ParsedPhone>) => onChange(formatPhone({ ...value, ...next }));

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor="phone-local">
        Phone <span className="text-muted-foreground">*</span>
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={value.countryId} onValueChange={(countryId) => patch({ countryId })}>
          <SelectTrigger className="sm:w-52" aria-label="Phone country">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHONE_COUNTRIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} (+{c.dial})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            +{country.dial}
          </span>
          <Input
            id="phone-local"
            name="tel"
            type="tel"
            autoComplete="tel-national"
            className="pl-14"
            placeholder={country.placeholder}
            inputMode="numeric"
            value={value.local}
            onChange={(e) => patch({ local: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function JoinContactFields({
  phone,
  address,
  onPhoneChange,
  onAddressChange,
}: {
  phone: string;
  address: string;
  onPhoneChange: (phone: string) => void;
  onAddressChange: (address: string) => void;
}) {
  return (
    <>
      <AddressFields value={parseAddress(address)} onChange={onAddressChange} />
      <PhoneField value={parsePhone(phone)} onChange={onPhoneChange} />
    </>
  );
}
